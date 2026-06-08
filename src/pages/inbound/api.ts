import { supabase } from '../../supabase/client';
import type { 
  MaterialInbound, 
  MaterialInboundItem, 
  InboundFormData,
  InboundFilterParams,
  PaginatedResponse
} from './types';

const PAGE_SIZE = 20;

export const inboundApi = {
  // 获取入库单列表
  async getInbounds(params: InboundFilterParams = {}): Promise<PaginatedResponse<MaterialInbound>> {
    const { keyword, project_id, warehouse_id, supplier_id, status, date_from, date_to, page = 1, page_size = PAGE_SIZE } = params;
    
    const offset = (page - 1) * page_size;
    let query = supabase
      .from('material_inbounds')
      .select(`
        *,
        warehouses(name),
        party_b(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + page_size - 1);
    
    if (keyword) {
      // 先查询匹配的供应商 ID
      const { data: matchedSuppliers } = await supabase
        .from('party_b')
        .select('id')
        .ilike('name', `%${keyword}%`);
      const supplierIds = matchedSuppliers?.map(s => s.id) || [];
      
      if (supplierIds.length > 0) {
        query = query.or(`inbound_no.ilike.%${keyword}%,supplier_id.in.(${supplierIds.join(',')})`);
      } else {
        query = query.ilike('inbound_no', `%${keyword}%`);
      }
    }
    
    if (project_id) {
      query = query.eq('project_id', project_id);
    }
    
    if (warehouse_id) {
      query = query.eq('warehouse_id', warehouse_id);
    }
    
    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (date_from) {
      query = query.gte('inbound_date', date_from);
    }
    
    if (date_to) {
      query = query.lte('inbound_date', date_to);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    return {
      data: data?.map(inbound => ({
        ...inbound,
        warehouse_name: inbound.warehouses?.name,
        supplier_name: inbound.party_b?.name
      })) || [],
      total: count || 0,
      page,
      page_size
    };
  },
  
  // 获取单个入库单详情
  async getInbound(id: string): Promise<MaterialInbound> {
    const { data, error } = await supabase
      .from('material_inbounds')
      .select(`
        *,
        warehouses(name),
        party_b(name)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      warehouse_name: data.warehouses?.name,
      supplier_name: data.party_b?.name
    };
  },
  
  // 获取入库单明细
  async getInboundItems(inboundId: string): Promise<MaterialInboundItem[]> {
    const { data, error } = await supabase
      .from('material_inbound_items')
      .select(`
        *,
        materials(name, code, specification)
      `)
      .eq('inbound_id', inboundId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return data?.map(item => ({
      ...item,
      material_name: item.materials?.name,
      material_code: item.materials?.code,
      specification: item.materials?.specification || item.specification
    })) || [];
  },
  
  // 创建入库单
  async createInbound(data: InboundFormData): Promise<MaterialInbound> {
    const { items, ...inboundData } = data;
    
    const { data: inbound, error: inboundError } = await supabase
      .from('material_inbounds')
      .insert(inboundData)
      .select()
      .single();
    
    if (inboundError) throw inboundError;
    
    // 创建入库明细
    if (items.length > 0) {
      const itemsData = items.map(item => ({
        inbound_id: inbound.id,
        material_id: item.material_id,
        specification: item.specification || null,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
        tax_rate: item.tax_rate,
        remark: item.remark || null
      }));
      
      await supabase.from('material_inbound_items').insert(itemsData);
      
      // 更新库存
      for (const item of items) {
        await supabase.rpc('update_material_stock', {
          p_material_id: item.material_id,
          p_quantity: item.quantity,
          p_warehouse_id: inboundData.warehouse_id
        });
      }
    }
    
    return inbound;
  },
  
  // 更新入库单
  async updateInbound(id: string, data: Partial<InboundFormData>): Promise<MaterialInbound> {
    const { items, ...inboundData } = data;
    
    const { data: inbound, error: inboundError } = await supabase
      .from('material_inbounds')
      .update(inboundData)
      .eq('id', id)
      .select()
      .single();
    
    if (inboundError) throw inboundError;
    
    // 更新入库明细
    if (items !== undefined) {
      await supabase.from('material_inbound_items').delete().eq('inbound_id', id);
      
      if (items.length > 0) {
        const itemsData = items.map(item => ({
          inbound_id: id,
          material_id: item.material_id,
          specification: item.specification || null,
          unit: item.unit,
          quantity: item.quantity,
          price: item.price,
          tax_rate: item.tax_rate,
          remark: item.remark || null
        }));
        
        await supabase.from('material_inbound_items').insert(itemsData);
      }
    }
    
    return inbound;
  },
  
  // 删除入库单
  async deleteInbound(id: string): Promise<void> {
    const { error } = await supabase
      .from('material_inbounds')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // 确认入库
  async confirmInbound(id: string): Promise<void> {
    const inbound = await this.getInbound(id);
    const items = await this.getInboundItems(id);
    
    // 更新库存
    for (const item of items) {
      await supabase.rpc('update_material_stock', {
        p_material_id: item.material_id,
        p_quantity: item.quantity,
        p_warehouse_id: inbound.warehouse_id
      });
    }
    
    // 更新状态
    const { error } = await supabase
      .from('material_inbounds')
      .update({ status: 'confirmed' })
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // 生成入库单编号
  async generateInboundNo(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const { data } = await supabase
      .from('material_inbounds')
      .select('inbound_no')
      .like('inbound_no', `IN${year}${month}%`)
      .order('inbound_no', { ascending: false })
      .limit(1);
    
    let maxNum = 0;
    if (data && data.length > 0 && data[0].inbound_no) {
      const numStr = data[0].inbound_no.replace(`IN${year}${month}`, '') || '0';
      maxNum = parseInt(numStr, 10) || 0;
    }
    
    const newNum = maxNum + 1;
    return `IN${year}${month}${newNum.toString().padStart(4, '0')}`;
  },
  
  // 获取采购订单列表（用于关联）
  async getPurchaseOrders(projectId?: string): Promise<{ id: string; order_no: string; supplier_name: string }[]> {
    let query = supabase
      .from('purchase_orders')
      .select(`
        id,
        order_no,
        party_b(name)
      `)
      .eq('status', 'approved');
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data?.map(o => ({
      id: o.id,
      order_no: o.order_no,
      supplier_name: o.party_b?.[0]?.name || ''
    })) || [];
  }
};

export default inboundApi;
