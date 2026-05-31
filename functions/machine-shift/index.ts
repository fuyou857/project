/**
 * 机械台班管理 API
 * 
 * 接口列表：
 * - GET  /api/machine-shift/records           - 分页查询台班记录
 * - POST /api/machine-shift/records           - 新增单条台班记录
 * - POST /api/machine-shift/records/batch    - 批量新增
 * - PUT  /api/machine-shift/records/:id      - 修改记录
 * - DELETE /api/machine-shift/records/:id    - 删除记录
 * - GET  /api/machine-shift/records/drill-down - 穿透明细数据
 * - GET  /api/machine-shift/statistics/project/:projectId - 按项目归集统计
 * - GET  /api/machine-shift/statistics/machine/:machineId - 按机械归集统计
 * - GET  /api/machine-shift/statistics/time  - 按时间范围汇总
 * - GET  /api/machine-shift/contracts/:projectId - 获取项目的机械租赁合同列表
 * 
 * 部署：supabase functions deploy machine-shift
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders } from '../_shared/cors.ts';

let _reqOrigin: string | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(_reqOrigin) },
  });
}

function getSupabaseClients() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  
  return { supabaseUrl, anonKey, admin };
}

Deno.serve(async (req: Request) => {
  _reqOrigin = req.headers.get('origin');
  const cors = getCorsHeaders(_reqOrigin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const { supabaseUrl, admin } = getSupabaseClients();
    const url = new URL(req.url);
    const pathname = url.pathname.replace('/supabase/functions/v1/machine-shift', '');

    // 路由匹配
    if (pathname === '/records' && req.method === 'GET') {
      // 分页查询台班记录
      return await handleListRecords(admin, url);
    }

    if (pathname === '/records' && req.method === 'POST') {
      // 新增单条台班记录
      return await handleCreateRecord(admin, await req.json());
    }

    if (pathname === '/records/batch' && req.method === 'POST') {
      // 批量新增
      return await handleBatchCreate(admin, await req.json());
    }

    if (pathname.match(/^\/records\/[^/]+$/) && req.method === 'PUT') {
      // 修改记录
      const id = pathname.split('/')[2];
      return await handleUpdateRecord(admin, id, await req.json());
    }

    if (pathname.match(/^\/records\/[^/]+$/) && req.method === 'DELETE') {
      // 删除记录
      const id = pathname.split('/')[2];
      return await handleDeleteRecord(admin, id);
    }

    if (pathname === '/records/drill-down' && req.method === 'GET') {
      // 穿透明细数据
      return await handleDrillDown(admin, url);
    }

    if (pathname.match(/^\/statistics\/project\/[^/]+$/) && req.method === 'GET') {
      // 按项目归集统计
      const projectId = pathname.split('/')[3];
      return await handleProjectStatistics(admin, projectId, url);
    }

    if (pathname.match(/^\/statistics\/machine\/[^/]+$/) && req.method === 'GET') {
      // 按机械归集统计
      const machineId = pathname.split('/')[3];
      return await handleMachineStatistics(admin, machineId);
    }

    if (pathname === '/statistics/time' && req.method === 'GET') {
      // 按时间范围汇总
      return await handleTimeStatistics(admin, url);
    }

    if (pathname.match(/^\/contracts\/[^/]+$/) && req.method === 'GET') {
      // 获取项目的机械租赁合同列表
      const projectId = pathname.split('/')[2];
      return await handleContractsList(admin, projectId);
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Machine shift API error:', msg);
    return json({ error: msg }, 400);
  }
});

// 分页查询台班记录
async function handleListRecords(admin: any, url: URL) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
  const projectId = url.searchParams.get('projectId');
  const machineId = url.searchParams.get('machineId');
  const status = url.searchParams.get('status');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  let query = admin
    .from('machine_shift_records')
    .select('*, machines(name, code, unit), projects(name), expense_contracts(contract_no, shift_price)', { count: 'exact' })
    .order('record_date', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (projectId) query = query.eq('project_id', projectId);
  if (machineId) query = query.eq('machine_id', machineId);
  if (status) query = query.eq('status', status);
  if (dateFrom) query = query.gte('record_date', dateFrom);
  if (dateTo) query = query.lte('record_date', dateTo);

  const { data, error, count } = await query;

  if (error) throw error;

  return json({
    success: true,
    data,
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize),
  });
}

// 新增单条台班记录
async function handleCreateRecord(admin: any, body: any) {
  const {
    project_id, machine_id, rental_contract_id, record_date, shift_count,
    start_time, end_time, cost_per_shift, operator, remark, images, created_by
  } = body;

  // 验证必填字段
  if (!project_id || !machine_id || !record_date || !shift_count) {
    return json({ error: '缺少必填字段：project_id, machine_id, record_date, shift_count' }, 400);
  }

  // 验证项目是否存在
  const { data: projectData, error: projectError } = await admin
    .from('projects')
    .select('id')
    .eq('id', project_id)
    .single();
  
  if (projectError || !projectData) {
    return json({ error: '项目不存在' }, 400);
  }

  // 如果选择了合同，自动带出台班单价
  let finalCostPerShift = cost_per_shift;
  if (!finalCostPerShift && rental_contract_id) {
    const { data: contract } = await admin
      .from('expense_contracts')
      .select('shift_price')
      .eq('id', rental_contract_id)
      .single();
    if (contract?.shift_price) {
      finalCostPerShift = contract.shift_price;
    }
  }

  // 如果没有合同单价，使用机械默认单价
  if (!finalCostPerShift) {
    const { data: machine } = await admin
      .from('machines')
      .select('default_shift_price')
      .eq('id', machine_id)
      .single();
    if (machine?.default_shift_price) {
      finalCostPerShift = machine.default_shift_price;
    }
  }

  const { data, error } = await admin
    .from('machine_shift_records')
    .insert({
      project_id,
      machine_id,
      rental_contract_id: rental_contract_id || null,
      record_date,
      shift_count,
      start_time: start_time || null,
      end_time: end_time || null,
      cost_per_shift: finalCostPerShift || null,
      operator: operator || null,
      remark: remark || null,
      images: images || [],
      created_by: created_by || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) throw error;

  return json({ success: true, data });
}

// 批量新增
async function handleBatchCreate(admin: any, body: any) {
  const { records, created_by } = body;

  if (!Array.isArray(records) || records.length === 0) {
    return json({ error: 'records 必须是非空数组' }, 400);
  }

  const insertData = records.map((record: any) => ({
    project_id: record.project_id,
    machine_id: record.machine_id,
    rental_contract_id: record.rental_contract_id || null,
    record_date: record.record_date,
    shift_count: record.shift_count,
    start_time: record.start_time || null,
    end_time: record.end_time || null,
    cost_per_shift: record.cost_per_shift || null,
    operator: record.operator || null,
    remark: record.remark || null,
    images: record.images || [],
    created_by: created_by || null,
    status: 'draft',
  }));

  const { data, error } = await admin
    .from('machine_shift_records')
    .insert(insertData)
    .select();

  if (error) throw error;

  return json({ success: true, data, count: data.length });
}

// 修改记录
async function handleUpdateRecord(admin: any, id: string, body: any) {
  const {
    project_id, machine_id, rental_contract_id, record_date, shift_count,
    start_time, end_time, cost_per_shift, operator, remark, images, status
  } = body;

  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (project_id !== undefined) updateData.project_id = project_id;
  if (machine_id !== undefined) updateData.machine_id = machine_id;
  if (rental_contract_id !== undefined) updateData.rental_contract_id = rental_contract_id;
  if (record_date !== undefined) updateData.record_date = record_date;
  if (shift_count !== undefined) updateData.shift_count = shift_count;
  if (start_time !== undefined) updateData.start_time = start_time;
  if (end_time !== undefined) updateData.end_time = end_time;
  if (cost_per_shift !== undefined) updateData.cost_per_shift = cost_per_shift;
  if (operator !== undefined) updateData.operator = operator;
  if (remark !== undefined) updateData.remark = remark;
  if (images !== undefined) updateData.images = images;
  if (status !== undefined) updateData.status = status;

  const { data, error } = await admin
    .from('machine_shift_records')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // 当状态变为 confirmed 时，更新合同使用量
  if (status === 'confirmed' && data.rental_contract_id) {
    await updateContractUsage(admin, data.rental_contract_id, data.shift_count, data.total_cost);
  }

  return json({ success: true, data });
}

// 更新合同使用量
async function updateContractUsage(admin: any, contractId: string, shiftCount: number, totalCost: number) {
  // 获取当前合同使用量
  const { data: contract, error: fetchError } = await admin
    .from('expense_contracts')
    .select('used_shifts, used_amount, total_budget_shifts, shift_price, contract_no')
    .eq('id', contractId)
    .single();

  if (fetchError || !contract) {
    console.warn('Contract not found:', contractId);
    return;
  }

  // 累加使用量
  const newUsedShifts = (contract.used_shifts || 0) + shiftCount;
  const newUsedAmount = (contract.used_amount || 0) + totalCost;

  // 更新合同
  await admin
    .from('expense_contracts')
    .update({
      used_shifts: newUsedShifts,
      used_amount: newUsedAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractId);

  // 检查是否超过 90% 预警阈值
  if (contract.total_budget_shifts && newUsedShifts >= contract.total_budget_shifts * 0.9) {
    // 创建预警通知
    await createContractWarning(admin, contractId, contract.contract_no, newUsedShifts, contract.total_budget_shifts, contract.shift_price);
  }

  console.log('Contract usage updated:', { contractId, newUsedShifts, newUsedAmount });
}

// 创建合同超量预警通知
async function createContractWarning(admin: any, contractId: string, contractNo: string | null, usedShifts: number, totalBudgetShifts: number, shiftPrice: number | null) {
  const warningMessage = `机械租赁合同 ${contractNo || contractId} 使用量已达 ${((usedShifts / totalBudgetShifts) * 100).toFixed(1)}%（${usedShifts} / ${totalBudgetShifts} 台班），请注意合同执行情况。`;

  // 查找合同负责人和项目经理
  const { data: contract } = await admin
    .from('expense_contracts')
    .select('project_id, created_by')
    .eq('id', contractId)
    .single();

  if (!contract) return;

  // 获取项目成员
  const { data: projectMembers } = await admin
    .from('project_members')
    .select('user_id')
    .eq('project_id', contract.project_id);

  const userIds = (projectMembers || []).map(m => m.user_id);
  if (contract.created_by && !userIds.includes(contract.created_by)) {
    userIds.push(contract.created_by);
  }

  // 插入预警通知
  if (userIds.length > 0) {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title: '合同使用量预警',
      body: warningMessage,
      category: 'warning',
      payload: {
        type: 'contract_warning',
        contract_id: contractId,
        used_shifts: usedShifts,
        total_budget_shifts: totalBudgetShifts,
      },
    }));

    await admin.from('notifications').insert(notifications);
  }

  console.log('Contract warning created:', warningMessage);
}

// 删除记录
async function handleDeleteRecord(admin: any, id: string) {
  const { error } = await admin
    .from('machine_shift_records')
    .delete()
    .eq('id', id);

  if (error) throw error;

  return json({ success: true });
}

// 穿透明细数据
async function handleDrillDown(admin: any, url: URL) {
  const projectId = url.searchParams.get('projectId');
  const machineId = url.searchParams.get('machineId');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const status = url.searchParams.get('status');
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

  let query = admin
    .from('machine_shift_records')
    .select('*, machines(name, code, unit), projects(name)', { count: 'exact' })
    .order('record_date', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (projectId) query = query.eq('project_id', projectId);
  if (machineId) query = query.eq('machine_id', machineId);
  if (status) query = query.eq('status', status);
  if (dateFrom) query = query.gte('record_date', dateFrom);
  if (dateTo) query = query.lte('record_date', dateTo);

  const { data, error, count } = await query;

  if (error) throw error;

  return json({
    success: true,
    data,
    total: count,
    page,
    pageSize,
  });
}

// 按项目归集统计
async function handleProjectStatistics(admin: any, projectId: string, url: URL) {
  const month = url.searchParams.get('month'); // 格式：YYYY-MM

  let dateFilter = '';
  let params: any[] = [projectId];

  if (month) {
    dateFilter = ` AND record_date >= $2 AND record_date < ($2::date + INTERVAL '1 month')`;
    params.push(month + '-01');
  }

  // 本月统计
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const currentMonthEnd = new Date(currentMonthStart);
  currentMonthEnd.setMonth(currentMonthEnd.getMonth() + 1);

  const { data: monthStats } = await admin.rpc('exec', {
    query: `
      SELECT 
        COALESCE(SUM(shift_count), 0) as total_shifts,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM machine_shift_records
      WHERE project_id = $1
        AND record_date >= $2
        AND record_date < $3
        AND status IN ('draft', 'pending', 'confirmed')
    `,
    params: [projectId, currentMonthStart.toISOString().split('T')[0], currentMonthEnd.toISOString().split('T')[0]]
  });

  // 累计统计
  const { data: totalStats } = await admin.rpc('exec', {
    query: `
      SELECT 
        COALESCE(SUM(shift_count), 0) as total_shifts,
        COALESCE(SUM(total_cost), 0) as total_cost
      FROM machine_shift_records
      WHERE project_id = $1
        AND status IN ('draft', 'pending', 'confirmed')
    `,
    params: [projectId]
  });

  // 按机械分组
  const { data: byMachine } = await admin
    .from('machine_shift_records')
    .select(`
      machine_id,
      machines(name, code, unit),
      SUM(shift_count) as total_shifts,
      SUM(total_cost) as total_cost
    `)
    .eq('project_id', projectId)
    .in('status', ['draft', 'pending', 'confirmed'])
    .group('machine_id, machines(name, code, unit)');

  return json({
    success: true,
    data: {
      month: monthStats?.[0] || { total_shifts: 0, total_cost: 0 },
      total: totalStats?.[0] || { total_shifts: 0, total_cost: 0 },
      byMachine: byMachine || [],
    }
  });
}

// 按机械归集统计
async function handleMachineStatistics(admin: any, machineId: string) {
  // 汇总统计
  const { data: totalStats } = await admin
    .from('machine_shift_records')
    .select(`
      SUM(shift_count) as total_shifts,
      SUM(total_cost) as total_cost,
      COUNT(*) as record_count
    `)
    .eq('machine_id', machineId)
    .in('status', ['draft', 'pending', 'confirmed'])
    .single();

  // 按项目分组
  const { data: byProject } = await admin
    .from('machine_shift_records')
    .select(`
      project_id,
      projects(name),
      SUM(shift_count) as total_shifts,
      SUM(total_cost) as total_cost
    `)
    .eq('machine_id', machineId)
    .in('status', ['draft', 'pending', 'confirmed'])
    .group('project_id, projects(name)');

  return json({
    success: true,
    data: {
      summary: totalStats || { total_shifts: 0, total_cost: 0, record_count: 0 },
      byProject: byProject || [],
    }
  });
}

// 按时间范围汇总（日报/月报）
async function handleTimeStatistics(admin: any, url: URL) {
  const type = url.searchParams.get('type') || 'daily'; // daily, monthly
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const projectId = url.searchParams.get('projectId');

  let query = admin
    .from('machine_shift_records')
    .select(`
      record_date,
      project_id,
      projects(name),
      SUM(shift_count) as total_shifts,
      SUM(total_cost) as total_cost,
      COUNT(*) as record_count
    `)
    .in('status', ['draft', 'pending', 'confirmed'])
    .group('record_date, project_id, projects(name)')
    .order('record_date', { ascending: false });

  if (dateFrom) query = query.gte('record_date', dateFrom);
  if (dateTo) query = query.lte('record_date', dateTo);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;

  if (error) throw error;

  // 汇总
  const summary = {
    total_shifts: data?.reduce((sum, d) => sum + parseFloat(d.total_shifts || 0), 0) || 0,
    total_cost: data?.reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0) || 0,
    total_records: data?.reduce((sum, d) => sum + parseInt(d.record_count || 0), 0) || 0,
  };

  return json({
    success: true,
    data: {
      details: data || [],
      summary,
    }
  });
}

// 获取项目的机械租赁合同列表
async function handleContractsList(admin: any, projectId: string) {
  const { data, error } = await admin
    .from('expense_contracts')
    .select('id, contract_no, contract_name, shift_price, total_budget_shifts, used_shifts, used_amount, status')
    .eq('project_id', projectId)
    .eq('contract_type', 'machine_rental')
    .neq('status', 'completed');

  if (error) throw error;

  return json({ success: true, data });
}
