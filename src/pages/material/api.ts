import { supabase } from '../../supabase/client';
import type { 
  Material, 
  MaterialCategory, 
  MaterialFormData, 
  MaterialFilterParams,
  PaginatedResponse,
  Warehouse
} from './types';

export const materialApi = {
  // 物资分类
  async getCategories(): Promise<MaterialCategory[]> {
    const { data, error } = await supabase
      .from('material_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  async createCategory(category: Partial<MaterialCategory>): Promise<MaterialCategory> {
    const { data, error } = await supabase
      .from('material_categories')
      .insert(category)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateCategory(id: string, category: Partial<MaterialCategory>): Promise<MaterialCategory> {
    const { data, error } = await supabase
      .from('material_categories')
      .update(category)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('material_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // 物资档案
  async getMaterials(params: MaterialFilterParams = {}): Promise<PaginatedResponse<Material>> {
    const { keyword, category_id, status, page = 1, page_size = 20 } = params;
    
    let query = supabase
      .from('materials')
      .select('*, material_categories(name)', { count: 'exact' });
    
    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,code.ilike.%${keyword}%,specification.ilike.%${keyword}%`);
    }
    
    if (category_id) {
      query = query.eq('category_id', category_id);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const from = (page - 1) * page_size;
    const to = from + page_size - 1;
    
    const { data, error, count } = await query
      .range(from, to)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return {
      data: data || [],
      total: count || 0,
      page,
      page_size
    };
  },

  async getMaterial(id: string): Promise<Material> {
    const { data, error } = await supabase
      .from('materials')
      .select('*, material_categories(name)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async createMaterial(material: MaterialFormData): Promise<Material> {
    const { data, error } = await supabase
      .from('materials')
      .insert(material)
      .select('*, material_categories(name)')
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateMaterial(id: string, material: Partial<MaterialFormData>): Promise<Material> {
    const { data, error } = await supabase
      .from('materials')
      .update(material)
      .eq('id', id)
      .select('*, material_categories(name)')
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteMaterial(id: string): Promise<void> {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // 仓库
  async getWarehouses(projectId?: string): Promise<Warehouse[]> {
    let query = supabase
      .from('warehouses')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  async createWarehouse(warehouse: Partial<Warehouse>): Promise<Warehouse> {
    const { data, error } = await supabase
      .from('warehouses')
      .insert(warehouse)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // 生成物资编码
  async generateMaterialCode(categoryId?: string): Promise<string> {
    const prefix = categoryId ? 'MAT' : 'MAT';
    const { data } = await supabase
      .from('materials')
      .select('code')
      .like('code', `${prefix}%`)
      .order('code', { ascending: false })
      .limit(1);
    
    let maxNum = 0;
    if (data && data.length > 0) {
      const lastCode = data[0].code;
      const numStr = lastCode?.replace(prefix, '').replace(/^0*/, '') || '0';
      maxNum = parseInt(numStr, 10) || 0;
    }
    
    const newNum = maxNum + 1;
    return `${prefix}${newNum.toString().padStart(6, '0')}`;
  },

  // 导出物资列表
  async exportMaterials(params: MaterialFilterParams = {}): Promise<Material[]> {
    const { keyword, category_id, status } = params;
    
    let query = supabase
      .from('materials')
      .select('*, material_categories(name)')
      .order('created_at', { ascending: false });
    
    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,code.ilike.%${keyword}%,specification.ilike.%${keyword}%`);
    }
    
    if (category_id) {
      query = query.eq('category_id', category_id);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }
};

export default materialApi;
