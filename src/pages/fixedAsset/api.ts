import { supabase } from '../../supabase/client';
import type { 
  FixedAsset, 
  AssetCategory, 
  AssetAllocation,
  AssetTransfer,
  AssetScrap,
  FixedAssetFormData,
  AllocationFormData,
  TransferFormData,
  ScrapFormData,
  AssetFilterParams,
  PaginatedResponse
} from './types';

const PAGE_SIZE = 20;

export const fixedAssetApi = {
  // 获取资产分类列表
  async getCategories(): Promise<AssetCategory[]> {
    const { data, error } = await supabase
      .from('asset_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },
  
  // 创建资产分类
  async createCategory(data: Omit<AssetCategory, 'id' | 'created_at' | 'updated_at'>): Promise<AssetCategory> {
    const { data: category, error } = await supabase
      .from('asset_categories')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return category;
  },
  
  // 更新资产分类
  async updateCategory(id: string, data: Partial<AssetCategory>): Promise<AssetCategory> {
    const { data: category, error } = await supabase
      .from('asset_categories')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return category;
  },
  
  // 删除资产分类
  async deleteCategory(id: string): Promise<void> {
    const { error } = await supabase
      .from('asset_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // 获取资产列表
  async getAssets(params: AssetFilterParams = {}): Promise<PaginatedResponse<FixedAsset>> {
    const { keyword, category_id, status, project_id, page = 1, page_size = PAGE_SIZE } = params;
    
    const offset = (page - 1) * page_size;
    let query = supabase
      .from('fixed_assets')
      .select(`
        *,
        asset_categories(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + page_size - 1);
    
    if (keyword) {
      query = query.or(`asset_no.ilike.%${keyword}%,name.ilike.%${keyword}%`);
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
      data: data?.map(asset => ({
        ...asset,
        category_name: asset.asset_categories?.name
      })) || [],
      total: count || 0,
      page,
      page_size
    };
  },
  
  // 获取单个资产详情
  async getAsset(id: string): Promise<FixedAsset> {
    const { data, error } = await supabase
      .from('fixed_assets')
      .select(`
        *,
        asset_categories(name)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      category_name: data.asset_categories?.name
    };
  },
  
  // 创建资产
  async createAsset(data: FixedAssetFormData): Promise<FixedAsset> {
    const { data: asset, error } = await supabase
      .from('fixed_assets')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    return asset;
  },
  
  // 更新资产
  async updateAsset(id: string, data: Partial<FixedAssetFormData>): Promise<FixedAsset> {
    const { data: asset, error } = await supabase
      .from('fixed_assets')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return asset;
  },
  
  // 删除资产
  async deleteAsset(id: string): Promise<void> {
    const { error } = await supabase
      .from('fixed_assets')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // 生成资产编号
  async generateAssetNo(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    
    const { data } = await supabase
      .from('fixed_assets')
      .select('asset_no')
      .like('asset_no', `FA${year}%`)
      .order('asset_no', { ascending: false })
      .limit(1);
    
    let maxNum = 0;
    if (data && data.length > 0 && data[0].asset_no) {
      const numStr = data[0].asset_no.replace(`FA${year}`, '') || '0';
      maxNum = parseInt(numStr, 10) || 0;
    }
    
    const newNum = maxNum + 1;
    return `FA${year}${newNum.toString().padStart(4, '0')}`;
  },
  
  // 获取资产领用记录
  async getAllocations(assetId?: string): Promise<AssetAllocation[]> {
    let query = supabase
      .from('asset_allocations')
      .select(`
        *,
        fixed_assets(name),
        projects(name)
      `)
      .order('allocate_date', { ascending: false });
    
    if (assetId) {
      query = query.eq('asset_id', assetId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data?.map(allocation => ({
      ...allocation,
      asset_name: allocation.fixed_assets?.name,
      project_name: allocation.projects?.name
    })) || [];
  },
  
  // 领用资产
  async allocateAsset(data: AllocationFormData): Promise<AssetAllocation> {
    const { data: allocation, error } = await supabase
      .from('asset_allocations')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    
    // 更新资产状态
    await supabase
      .from('fixed_assets')
      .update({ status: 'in_use', current_project_id: data.project_id })
      .eq('id', data.asset_id);
    
    return allocation;
  },
  
  // 归还资产
  async returnAsset(allocationId: string): Promise<void> {
    const { data: allocation, error } = await supabase
      .from('asset_allocations')
      .update({ status: 'returned', return_date: new Date().toISOString().split('T')[0] })
      .eq('id', allocationId)
      .select()
      .single();
    
    if (error) throw error;
    
    // 更新资产状态
    await supabase
      .from('fixed_assets')
      .update({ status: 'in_stock', current_project_id: null })
      .eq('id', allocation.asset_id);
  },
  
  // 获取资产调拨记录
  async getTransfers(assetId?: string): Promise<AssetTransfer[]> {
    let query = supabase
      .from('asset_transfers')
      .select(`
        *,
        fixed_assets(name),
        from_project:projects(name),
        to_project:projects!to_project_id(name)
      `)
      .order('transfer_date', { ascending: false });
    
    if (assetId) {
      query = query.eq('asset_id', assetId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data?.map(transfer => ({
      ...transfer,
      asset_name: transfer.fixed_assets?.name,
      from_project_name: transfer.from_project?.name,
      to_project_name: transfer.to_project?.name
    })) || [];
  },
  
  // 调拨资产
  async transferAsset(data: TransferFormData): Promise<AssetTransfer> {
    const { data: transfer, error } = await supabase
      .from('asset_transfers')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    
    // 更新资产当前项目
    await supabase
      .from('fixed_assets')
      .update({ current_project_id: data.to_project_id })
      .eq('id', data.asset_id);
    
    return transfer;
  },
  
  // 获取资产报废记录
  async getScraps(assetId?: string): Promise<AssetScrap[]> {
    let query = supabase
      .from('asset_scraps')
      .select(`
        *,
        fixed_assets(name)
      `)
      .order('scrap_date', { ascending: false });
    
    if (assetId) {
      query = query.eq('asset_id', assetId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data?.map(scrap => ({
      ...scrap,
      asset_name: scrap.fixed_assets?.name
    })) || [];
  },
  
  // 报废资产
  async scrapAsset(data: ScrapFormData): Promise<AssetScrap> {
    const { data: scrap, error } = await supabase
      .from('asset_scraps')
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    
    // 更新资产状态
    await supabase
      .from('fixed_assets')
      .update({ status: 'scrapped', current_project_id: null })
      .eq('id', data.asset_id);
    
    return scrap;
  }
};

export default fixedAssetApi;
