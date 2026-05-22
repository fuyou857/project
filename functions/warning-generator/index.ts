Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const warnings: string[] = [];

    // 1. 印章外借超期未归还预警
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
            // 检查是否已存在相同预警
            const { data: existing } = await supabase
              .from('warnings')
              .select('id')
              .eq('warning_type', '印章超期')
              .eq('project_id', record.project_id)
              .eq('status', 'pending')
              .maybeSingle();

            if (!existing) {
              await supabase.from('warnings').insert({
                warning_type: '印章超期',
                content: `印章外借超期未归还，借章人：${record.borrower_name || '未知'}，应归还时间：${new Date(record.expected_return_date).toLocaleDateString()}`,
                project_id: record.project_id,
                status: 'pending',
              });
              warnings.push('印章超期预警已生成');
            }
          }
        }
      }
    }

    // 2. 已付款缺票超过30天预警
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
        const { data: existing } = await supabase
          .from('warnings')
          .select('id')
          .eq('warning_type', '缺票提醒')
          .eq('project_id', payment.project_id)
          .eq('status', 'pending')
          .maybeSingle();

        if (!existing) {
          const { data: project } = await supabase
            .from('projects')
            .select('name')
            .eq('id', payment.project_id)
            .maybeSingle();

          await supabase.from('warnings').insert({
            warning_type: '缺票提醒',
            content: `【催票提醒】项目【${project?.name || '未知'}】付款已超过30天仍未收到发票`,
            project_id: payment.project_id,
            status: 'pending',
          });
          warnings.push('缺票提醒预警已生成');
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: '预警生成完成',
      details: warnings
    }), { headers: corsHeaders });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
