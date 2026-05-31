
import { supabase } from '../../supabase/client';
import type {
  Machine,
  MachineCategory,
  MachineShift,
  MachineFormData,
  ShiftFormData,
  MachineFilterParams,
  ShiftFilterParams,
  PaginatedResponse,
  MachineStatistics,
  RentalContract
} from './types';

const PAGE_SIZE = 20;

export const machineApi = {
  // 机械分类相关
  async getCategories(): Promise<MachineCategory[]> {
    const { data, error } = await supabase
      .from('machine_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createCategory(data: Omit<MachineCategory, 'id' | 'created_at' | 'updated_at'>): Promise<MachineCategory> {
    const { data: category, error } = await supabase
      .from('machine_categories')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return category;
  },

  async updateCategory(id: string, data: Partial<MachineCategory>): Promise<MachineCategory> {
    const { data: category, error } = await supabase
      .from('machine_categories')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return category;
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('machine_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // 机械档案相关
  async getMachines(params: MachineFilterParams = {}): Promise<PaginatedResponse<Machine>> {
    const { keyword, category_id, status, project_id, page = 1, page_size = PAGE_SIZE } = params;

    const offset = (page - 1) * page_size;
    let query = supabase
      .from('machines')
      .select(`
        *,
        machine_categories(name),
        projects(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + page_size - 1);

    if (keyword) {
      query = query.or(`code.ilike.%${keyword}%,name.ilike.%${keyword}%`);
    }
    if (category_id) {
      query = query.eq('category_id', category_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (project_id) {
      query = query.eq('current_project_id', project_id);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: data?.map(machine => ({
        ...machine,
        category_name: machine.machine_categories?.name,
        current_project_name: machine.projects?.name
      })) || [],
      total: count || 0,
      page,
      page_size
    };
  },

  async getMachine(id: string): Promise<Machine> {
    const { data, error } = await supabase
      .from('machines')
      .select(`
        *,
        machine_categories(name),
        projects(name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      ...data,
      category_name: data.machine_categories?.name,
      current_project_name: data.projects?.name
    };
  },

  async createMachine(data: MachineFormData): Promise<Machine> {
    const { data: machine, error } = await supabase
      .from('machines')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return machine;
  },

  async updateMachine(id: string, data: Partial<MachineFormData>): Promise<Machine> {
    const { data: machine, error } = await supabase
      .from('machines')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return machine;
  },

  async deleteMachine(id: string): Promise<void> {
    const { error } = await supabase
      .from('machines')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async generateMachineCode(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();

    const { data } = await supabase
      .from('machines')
      .select('code')
      .like('code', `MAC${year}%`)
      .order('code', { ascending: false })
      .limit(1);

    let maxNum = 0;
    if (data && data.length > 0 && data[0].code) {
      const numStr = data[0].code.replace(`MAC${year}`, '') || '0';
      maxNum = parseInt(numStr, 10) || 0;
    }

    const newNum = maxNum + 1;
    return `MAC${year}${newNum.toString().padStart(4, '0')}`;
  },

  // 台班记录相关
  async getShifts(params: ShiftFilterParams = {}): Promise<PaginatedResponse<MachineShift>> {
    const { keyword, project_id, machine_id, status, date_from, date_to, page = 1, page_size = PAGE_SIZE } = params;

    const offset = (page - 1) * page_size;
    let query = supabase
      .from('machine_shifts')
      .select(`
        *,
        machines(name, code),
        projects(name),
        expense_contracts(contract_no)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + page_size - 1);

    if (keyword) {
      query = query.or(`machines.name.ilike.%${keyword}%,machines.code.ilike.%${keyword}%`);
    }
    if (project_id) {
      query = query.eq('project_id', project_id);
    }
    if (machine_id) {
      query = query.eq('machine_id', machine_id);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (date_from) {
      query = query.gte('record_date', date_from);
    }
    if (date_to) {
      query = query.lte('record_date', date_to);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: data?.map(shift => ({
        ...shift,
        machine_name: shift.machines?.name,
        machine_code: shift.machines?.code,
        project_name: shift.projects?.name,
        rental_contract_no: shift.expense_contracts?.contract_no
      })) || [],
      total: count || 0,
      page,
      page_size
    };
  },

  async getShift(id: string): Promise<MachineShift> {
    const { data, error } = await supabase
      .from('machine_shifts')
      .select(`
        *,
        machines(name, code),
        projects(name),
        expense_contracts(contract_no)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      ...data,
      machine_name: data.machines?.name,
      machine_code: data.machines?.code,
      project_name: data.projects?.name,
      rental_contract_no: data.expense_contracts?.contract_no
    };
  },

  async createShift(data: ShiftFormData): Promise<MachineShift> {
    const { data: shift, error } = await supabase
      .from('machine_shifts')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return shift;
  },

  async updateShift(id: string, data: Partial<ShiftFormData>): Promise<MachineShift> {
    const { data: shift, error } = await supabase
      .from('machine_shifts')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return shift;
  },

  async deleteShift(id: string): Promise<void> {
    const { error } = await supabase
      .from('machine_shifts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async submitForApproval(id: string): Promise<void> {
    const { error } = await supabase
      .from('machine_shifts')
      .update({ status: 'pending' })
      .eq('id', id);

    if (error) throw error;
  },

  // 统计相关
  async getStatistics(projectId?: string): Promise<MachineStatistics> {
    let query = supabase.from('machine_shifts').select('*');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const shifts = data || [];
    const total_shifts = shifts.reduce((sum, s) => sum + (s.shift_count || 0), 0);
    const total_cost = shifts.reduce((sum, s) => sum + (s.total_cost || 0), 0);

    const by_machine: any = {};
    const by_project: any = {};
    const by_date: any = {};

    shifts.forEach(shift => {
      const machineId = shift.machine_id;
      const projectId = shift.project_id;
      const date = shift.record_date;

      if (!by_machine[machineId]) {
        by_machine[machineId] = { machine_id: machineId, total_shifts: 0, total_cost: 0 };
      }
      by_machine[machineId].total_shifts += (shift.shift_count || 0);
      by_machine[machineId].total_cost += (shift.total_cost || 0);

      if (!by_project[projectId]) {
        by_project[projectId] = { project_id: projectId, total_shifts: 0, total_cost: 0 };
      }
      by_project[projectId].total_shifts += (shift.shift_count || 0);
      by_project[projectId].total_cost += (shift.total_cost || 0);

      if (!by_date[date]) {
        by_date[date] = { record_date: date, total_shifts: 0, total_cost: 0 };
      }
      by_date[date].total_shifts += (shift.shift_count || 0);
      by_date[date].total_cost += (shift.total_cost || 0);
    });

    return {
      summary: {
        total_shifts,
        total_cost,
        machine_count: Object.keys(by_machine).length
      },
      by_machine: Object.values(by_machine),
      by_project: Object.values(by_project),
      by_date: Object.values(by_date)
    };
  },

  // 租赁合同相关
  async getRentalContracts(projectId?: string): Promise<RentalContract[]> {
    let query = supabase.from('expense_contracts')
      .select('*')
      .eq('contract_type', 'equipment_rental');

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }
};

export default machineApi;
