import { supabase } from '../supabase/client';

export interface MachineShiftRecord {
  id: string;
  project_id: string;
  machine_id: string;
  rental_contract_id?: string;
  record_date: string;
  shift_count: number;
  cost_per_shift: number;
  total_cost: number;
  operator?: string;
  remark?: string;
  status: string;
  approval_id?: string;
  is_settled: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export async function fetchMachineShiftRecords(filter?: {
  projectId?: string;
  machineId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<MachineShiftRecord[]> {
  let query = supabase
    .from('machine_shift_records')
    .select('*')
    .order('record_date', { ascending: false });

  if (filter?.projectId) {
    query = query.eq('project_id', filter.projectId);
  }
  if (filter?.machineId) {
    query = query.eq('machine_id', filter.machineId);
  }
  if (filter?.dateFrom) {
    query = query.gte('record_date', filter.dateFrom);
  }
  if (filter?.dateTo) {
    query = query.lte('record_date', filter.dateTo);
  }
  if (filter?.status) {
    query = query.eq('status', filter.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createMachineShiftRecord(record: Partial<MachineShiftRecord>): Promise<MachineShiftRecord> {
  const { data, error } = await supabase
    .from('machine_shift_records')
    .insert(record)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMachineShiftRecord(id: string, record: Partial<MachineShiftRecord>): Promise<MachineShiftRecord> {
  const { data, error } = await supabase
    .from('machine_shift_records')
    .update({ ...record, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMachineShiftRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('machine_shift_records')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function fetchProjectOptions(): Promise<{ value: string; label: string }[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('name');
  if (error) throw error;
  return (data || []).map(p => ({ value: p.id, label: p.name }));
}

export async function fetchMachineOptions(projectId?: string): Promise<{ value: string; label: string }[]> {
  let query = supabase
    .from('machines')
    .select('id, name')
    .order('name');
  
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(m => ({ value: m.id, label: m.name }));
}

export async function fetchContractsByProject(projectId: string): Promise<{ value: string; label: string }[]> {
  const { data, error } = await supabase
    .from('expense_contracts')
    .select('id, contract_name')
    .eq('project_id', projectId)
    .eq('contract_type', 'machine_rental')
    .order('contract_name');
  if (error) throw error;
  return (data || []).map(c => ({ value: c.id, label: c.contract_name }));
}

export async function fetchMachineShiftStats(projectId?: string) {
  let query = supabase
    .from('machine_shift_records')
    .select('shift_count, total_cost');

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const records = data || [];
  const totalShifts = records.reduce((sum, r) => sum + Number(r.shift_count), 0);
  const totalCost = records.reduce((sum, r) => sum + Number(r.total_cost), 0);

  return { totalShifts, totalCost, count: records.length };
}
