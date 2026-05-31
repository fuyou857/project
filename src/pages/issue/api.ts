import { supabase } from '../../supabase/client';
import type { 
  MaterialIssue, 
  MaterialIssueItem, 
  IssueFormData,
  IssueFilterParams,
  PaginatedResponse
} from './types';

const PAGE_SIZE = 20;

export const issueApi = {
  // 获取领料单列表
  async getIssues(params: IssueFilterParams = {}): Promise<PaginatedResponse<MaterialIssue>> {
    const { keyword, project_id, warehouse_id, status, date_from, date_to, page = 1, page_size = PAGE_SIZE } = params;
    
    const offset = (page - 1) * page_size;
    let query = supabase
      .from('material_issues')
      .select(`
        *,
        warehouses(name),
        projects(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + page_size - 1);
    
    if (keyword) {
      query = query.or(`issue_no.ilike.%${keyword}%,projects(name).ilike.%${keyword}%`);
    }
    
    if (project_id) {
      query = query.eq('project_id', project_id);
    }
    
    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (date_from) {
      query = query.gte('issue_date', date_from);
    }
    
    if (date_to) {
      query = query.lte('issue_date', date_to);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    return {
      data: data?.map(issue => ({
        ...issue,
        warehouse_name: issue.warehouses?.name,
        project_name: issue.projects?.name
      })) || [],
      total: count || 0,
      page,
      page_size
    };
  },
  
  // 获取单个领料单详情
  async getIssue(id: string): Promise<MaterialIssue> {
    const { data, error } = await supabase
      .from('material_issues')
      .select(`
        *,
        warehouses(name),
        projects(name)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      warehouse_name: data.warehouses?.name,
      project_name: data.projects?.name
    };
  },
  
  // 获取领料单明细
  async getIssueItems(issueId: string): Promise<MaterialIssueItem[]> {
    const { data, error } = await supabase
      .from('material_issue_items')
      .select(`
        *,
        materials(name, code, specification)
      `)
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return data?.map(item => ({
      ...item,
      material_name: item.materials?.name,
      material_code: item.materials?.code,
      specification: item.materials?.specification || item.specification
    })) || [];
  },
  
  // 创建领料单
  async createIssue(data: IssueFormData): Promise<MaterialIssue> {
    const { items, ...issueData } = data;
    
    const { data: issue, error: issueError } = await supabase
      .from('material_issues')
      .insert(issueData)
      .select()
      .single();
    
    if (issueError) throw issueError;
    
    // 创建领料明细
    if (items.length > 0) {
      const itemsData = items.map(item => ({
        issue_id: issue.id,
        material_id: item.material_id,
        specification: item.specification || null,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        tax_rate: item.tax_rate,
        remark: item.remark || null
      }));
      
      await supabase.from('material_issue_items').insert(itemsData);
      
      // 更新库存（减少）
      for (const item of items) {
        await supabase.rpc('update_material_stock', {
          p_material_id: item.material_id,
          p_quantity: -item.quantity,
          p_warehouse_id: issueData.warehouse_id
        });
      }
      
      // 归集项目成本
      await this.allocateCost(issue.id, data.project_id);
    }
    
    return issue;
  },
  
  // 更新领料单
  async updateIssue(id: string, data: Partial<IssueFormData>): Promise<MaterialIssue> {
    const { items, ...issueData } = data;
    
    const { data: issue, error: issueError } = await supabase
      .from('material_issues')
      .update(issueData)
      .eq('id', id)
      .select()
      .single();
    
    if (issueError) throw issueError;
    
    // 更新领料明细
    if (items !== undefined) {
      await supabase.from('material_issue_items').delete().eq('issue_id', id);
      
      if (items.length > 0) {
        const itemsData = items.map(item => ({
          issue_id: id,
          material_id: item.material_id,
          specification: item.specification || null,
          unit: item.unit,
          quantity: item.quantity,
          price: item.price,
          tax_rate: item.tax_rate,
          remark: item.remark || null
        }));
        
        await supabase.from('material_issue_items').insert(itemsData);
      }
    }
    
    return issue;
  },
  
  // 删除领料单
  async deleteIssue(id: string): Promise<void> {
    const { error } = await supabase
      .from('material_issues')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // 确认领料
  async confirmIssue(id: string): Promise<void> {
    const issue = await this.getIssue(id);
    const items = await this.getIssueItems(id);
    
    // 更新库存
    for (const item of items) {
      await supabase.rpc('update_material_stock', {
        p_material_id: item.material_id,
        p_quantity: -item.quantity,
        p_warehouse_id: issue.warehouse_id
      });
    }
    
    // 归集项目成本
    await this.allocateCost(id, issue.project_id);
    
    // 更新状态
    const { error } = await supabase
      .from('material_issues')
      .update({ status: 'confirmed' })
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // 归集项目成本
  async allocateCost(issueId: string, projectId: string): Promise<void> {
    const items = await this.getIssueItems(issueId);
    
    const totalCost = items.reduce((sum, item) => {
      return sum + (item.quantity * item.price * (1 + item.tax_rate / 100));
    }, 0);
    
    // 记录成本归集
    await supabase.from('project_costs').insert({
      project_id: projectId,
      cost_type: 'material',
      amount: totalCost,
      source_id: issueId,
      source_type: 'issue'
    });
  },
  
  // 生成领料单编号
  async generateIssueNo(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const { data } = await supabase
      .from('material_issues')
      .select('issue_no')
      .like('issue_no', `OU${year}${month}%`)
      .order('issue_no', { ascending: false })
      .limit(1);
    
    let maxNum = 0;
    if (data && data.length > 0 && data[0].issue_no) {
      const numStr = data[0].issue_no.replace(`OU${year}${month}`, '') || '0';
      maxNum = parseInt(numStr, 10) || 0;
    }
    
    const newNum = maxNum + 1;
    return `OU${year}${month}${newNum.toString().padStart(4, '0')}`;
  },
  
  // 获取仓库库存
  async getWarehouseStock(warehouseId: string): Promise<{ material_id: string; stock: number }[]> {
    const { data, error } = await supabase
      .from('warehouse_stocks')
      .select('material_id, stock')
      .eq('warehouse_id', warehouseId);
    
    if (error) throw error;
    
    return data || [];
  }
};

export default issueApi;
