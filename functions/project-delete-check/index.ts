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
    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ code: 400, message: '缺少项目ID' }), { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const checkTable = async (table: string, projectField: string, nameField?: string) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${projectField}=eq.${projectId}&select=id,${nameField || 'name'}`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      return await res.json();
    };

    const details: Array<{ type: string; count: number; examples: string[] }> = [];

    const [partyB, costInv, payment, seal, material, machine, labor, worker, warning] = await Promise.all([
      checkTable('project_suppliers', 'project_id', 'supplier_name'),
      checkTable('cost_invoices', 'project_id', 'invoice_number'),
      checkTable('payment_records', 'project_id', 'payment_type'),
      checkTable('seal_usage_records', 'project_id', 'usage_reason'),
      checkTable('materials', 'project_id', 'material_name'),
      checkTable('machine_usage', 'project_id'),
      checkTable('labor_teams', 'project_id', 'team_name'),
      checkTable('workers', 'project_id', 'name'),
      checkTable('warnings', 'project_id', 'content')
    ]);

    if (partyB?.length > 0) details.push({ type: '乙方单位', count: partyB.length, examples: partyB.slice(0, 3).map((d: any) => d.supplier_name || '未命名') });
    if (costInv?.length > 0) details.push({ type: '成本发票', count: costInv.length, examples: costInv.slice(0, 3).map((d: any) => d.invoice_number || '无发票号') });
    if (payment?.length > 0) details.push({ type: '工程款支付记录', count: payment.length, examples: payment.slice(0, 3).map((d: any) => `${d.payment_type || '支付'}-${d.amount || 0}元`) });
    if (seal?.length > 0) details.push({ type: '印章申请记录', count: seal.length, examples: seal.slice(0, 3).map((d: any) => d.usage_reason?.substring(0, 15) || '用章申请') });
    if (material?.length > 0) details.push({ type: '物资管理', count: material.length, examples: material.slice(0, 3).map((d: any) => d.material_name || '物资') });
    if (machine?.length > 0) details.push({ type: '机械管理', count: machine.length, examples: ['台班记录'] });
    if (labor?.length > 0) details.push({ type: '劳务管理', count: labor.length, examples: labor.slice(0, 3).map((d: any) => d.team_name || '劳务队') });
    if (worker?.length > 0) details.push({ type: '农民工档案', count: worker.length, examples: worker.slice(0, 3).map((d: any) => d.name || '工人') });
    if (warning?.length > 0) details.push({ type: '预警记录', count: warning.length, examples: warning.slice(0, 3).map((d: any) => d.content?.substring(0, 15) || '预警') });

    if (details.length > 0) {
      return new Response(JSON.stringify({ code: 400, message: '项目无法删除，已被以下数据关联：', details }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ code: 200, message: '可以删除' }), { headers: corsHeaders });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ code: 500, message: errMsg }), { status: 500, headers: corsHeaders });
  }
});
