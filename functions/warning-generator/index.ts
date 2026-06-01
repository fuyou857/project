Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': 'https://www.ciond.com',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://www.ciond.com',
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const alertsGenerated: string[] = [];

    // ============================================================
    // 1. 印章外借超期预警
    // ============================================================
    const { data: sealRecords } = await supabase
      .from('seal_usage_records')
      .select('*')
      .eq('status', 'active')
      .eq('usage_type', '印章外借');

    if (sealRecords) {
      const now = new Date();
      for (const record of sealRecords) {
        if (record.expected_return_date) {
          const expectedReturn = new Date(record.expected_return_date);
          if (expectedReturn < now) {
            await insertAlert(supabase, {
              project_id: record.project_id,
              alert_type: 'seal_overdue',
              title: '印章外借超期',
              content: `印章外借超期未归还，借章人：${record.borrower_name || '未知'}，应归还时间：${new Date(record.expected_return_date).toLocaleDateString()}`,
              severity: 'warning',
              source_id: record.id,
              source_type: 'seal_usage_record',
            }, alertsGenerated);
          }
        }
      }
    }

    // ============================================================
    // 2. 已付款缺票超过30天预警
    // ============================================================
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: uninvoicedPayments } = await supabase
      .from('payment_records')
      .select('*')
      .eq('status', 'completed')
      .is('invoice_id', null)
      .lt('transfer_date', thirtyDaysAgo.toISOString().split('T')[0]);

    if (uninvoicedPayments) {
      for (const payment of uninvoicedPayments) {
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', payment.project_id)
          .maybeSingle();

        await insertAlert(supabase, {
          project_id: payment.project_id,
          alert_type: 'missing_invoice',
          title: '缺票提醒',
          content: `【催票提醒】项目【${project?.name || '未知'}】付款已超过30天仍未收到发票`,
          severity: 'warning',
          source_id: payment.id,
          source_type: 'payment_record',
        }, alertsGenerated);
      }
    }

    // ============================================================
    // 3. 支出合同超预算预警（已用金额 > 90%）
    // ============================================================
    const { data: expenseContracts } = await supabase
      .from('expense_contracts')
      .select('id, project_id, contract_amount, party_b_name, name')
      .not('contract_amount', 'is', null)
      .gt('contract_amount', 0);

    if (expenseContracts) {
      for (const contract of expenseContracts) {
        const { data: payments } = await supabase
          .from('payment_records')
          .select('amount')
          .eq('contract_id', contract.id);
        const totalPaid = (payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const contractAmount = Number(contract.contract_amount);
        if (contractAmount > 0) {
          const usedPercent = (totalPaid / contractAmount) * 100;
          if (usedPercent >= 90 && usedPercent < 100) {
            await insertAlert(supabase, {
              project_id: contract.project_id,
              alert_type: 'contract_over_budget',
              title: '合同即将超预算',
              content: `合同【${contract.name || contract.party_b_name || '未知'}】已使用 ${usedPercent.toFixed(1)}%，接近预算上限`,
              severity: 'warning',
              source_id: contract.id,
              source_type: 'expense_contract',
            }, alertsGenerated);
          } else if (usedPercent >= 100) {
            await insertAlert(supabase, {
              project_id: contract.project_id,
              alert_type: 'contract_over_budget',
              title: '合同已超预算',
              content: `合同【${contract.name || contract.party_b_name || '未知'}】已超出预算 ${(usedPercent - 100).toFixed(1)}%`,
              severity: 'critical',
              source_id: contract.id,
              source_type: 'expense_contract',
            }, alertsGenerated);
          }
        }
      }
    }

    // ============================================================
    // 4. 审批超时预警（待办 > 48 小时未处理）
    // ============================================================
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data: overdueApprovals } = await supabase
      .from('approvals')
      .select('id, source_type, source_id, created_at, created_by')
      .eq('status', 'pending')
      .lt('created_at', twoDaysAgo.toISOString());

    if (overdueApprovals) {
      for (const approval of overdueApprovals) {
        await insertAlert(supabase, {
          project_id: null,
          alert_type: 'approval_timeout',
          title: '审批超时',
          content: `${approval.source_type} 审批已超过 48 小时未处理`,
          severity: 'warning',
          source_id: approval.id,
          source_type: 'approval',
        }, alertsGenerated);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `预警扫描完成，生成 ${alertsGenerated.length} 条预警`,
        details: alertsGenerated
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: corsHeaders
    });
  }
});

/**
 * 插入预警记录（避免重复）
 */
async function insertAlert(
  supabase: any,
  alert: {
    project_id: string | null;
    alert_type: string;
    title: string;
    content: string;
    severity: string;
    source_id: string;
    source_type: string;
  },
  alertsGenerated: string[]
) {
  try {
    const { data: existing } = await supabase
      .from('alerts')
      .select('id')
      .eq('source_id', alert.source_id)
      .eq('source_type', alert.source_type)
      .eq('status', 'active')
      .maybeSingle();

    if (!existing) {
      await supabase.from('alerts').insert({
        ...alert,
        status: 'active',
        created_at: new Date().toISOString()
      });
      alertsGenerated.push(`${alert.title}`);
    }
  } catch (err) {
    console.error('插入预警失败:', err);
  }
}
