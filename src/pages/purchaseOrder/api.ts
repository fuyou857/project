import { supabase } from '../../supabase/client';
import type { 
  PurchaseOrder, 
  PurchaseOrderItem, 
  PurchaseOrderFormData,
  PurchaseOrderFilterParams,
  PaginatedResponse
} from './types';

const PAGE_SIZE = 20;

export const purchaseOrderApi = {
  // 获取采购订单列表
  async getOrders(params: PurchaseOrderFilterParams = {}): Promise<PaginatedResponse<PurchaseOrder>> {
    const { keyword, project_id, supplier_id, status, date_from, date_to, page = 1, page_size = PAGE_SIZE } = params;
    
    const offset = (page - 1) * page_size;
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        party_b(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + page_size - 1);
    
    if (keyword) {
      query = query.or(`order_no.ilike.%${keyword}%,party_b(name).ilike.%${keyword}%`);
    }
    
    if (project_id) {
      query = query.eq('project_id', project_id);
    }
    
    if (supplier_id) {
      query = query.eq('supplier_id', supplier_id);
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (date_from) {
      query = query.gte('order_date', date_from);
    }
    
    if (date_to) {
      query = query.lte('order_date', date_to);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    return {
      data: data?.map(order => ({
        ...order,
        supplier_name: order.party_b?.name
      })) || [],
      total: count || 0,
      page,
      page_size
    };
  },
  
  // 获取单个订单详情
  async getOrder(id: string): Promise<PurchaseOrder> {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        party_b(name)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return {
      ...data,
      supplier_name: data.party_b?.name
    };
  },
  
  // 获取订单明细
  async getOrderItems(orderId: string): Promise<PurchaseOrderItem[]> {
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select(`
        *,
        materials(name, code, specification)
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return data?.map(item => ({
      ...item,
      material_name: item.materials?.name,
      material_code: item.materials?.code,
      specification: item.materials?.specification || item.specification
    })) || [];
  },
  
  // 创建采购订单
  async createOrder(data: PurchaseOrderFormData): Promise<PurchaseOrder> {
    const { items, ...orderData } = data;
    
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .insert(orderData)
      .select()
      .single();
    
    if (orderError) throw orderError;
    
    // 创建订单明细
    if (items.length > 0) {
      const itemsData = items.map(item => ({
        order_id: order.id,
        material_id: item.material_id,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        tax_rate: item.tax_rate,
        remark: item.remark || null
      }));
      
      await supabase.from('purchase_order_items').insert(itemsData);
    }
    
    return order;
  },
  
  // 更新采购订单
  async updateOrder(id: string, data: Partial<PurchaseOrderFormData>): Promise<PurchaseOrder> {
    const { items, ...orderData } = data;
    
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .update(orderData)
      .eq('id', id)
      .select()
      .single();
    
    if (orderError) throw orderError;
    
    // 更新订单明细（先删除再插入）
    if (items !== undefined) {
      await supabase.from('purchase_order_items').delete().eq('order_id', id);
      
      if (items.length > 0) {
        const itemsData = items.map(item => ({
          order_id: id,
          material_id: item.material_id,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
          tax_rate: item.tax_rate,
          remark: item.remark || null
        }));
        
        await supabase.from('purchase_order_items').insert(itemsData);
      }
    }
    
    return order;
  },
  
  // 删除采购订单
  async deleteOrder(id: string): Promise<void> {
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // 更新订单状态
  async updateOrderStatus(id: string, status: PurchaseOrder['status']): Promise<void> {
    const { error } = await supabase
      .from('purchase_orders')
      .update({ status })
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // 生成订单编号
  async generateOrderNo(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    const { data } = await supabase
      .from('purchase_orders')
      .select('order_no')
      .like('order_no', `PO${year}${month}%`)
      .order('order_no', { ascending: false })
      .limit(1);
    
    let maxNum = 0;
    if (data && data.length > 0 && data[0].order_no) {
      const numStr = data[0].order_no.replace(`PO${year}${month}`, '') || '0';
      maxNum = parseInt(numStr, 10) || 0;
    }
    
    const newNum = maxNum + 1;
    return `PO${year}${month}${newNum.toString().padStart(4, '0')}`;
  },
  
  // 获取项目的采购合同列表
  async getProjectContracts(projectId: string): Promise<{ id: string; contract_no: string; supplier_name: string }[]> {
    const { data, error } = await supabase
      .from('expense_contracts')
      .select(`
        id,
        contract_no,
        party_b(name)
      `)
      .eq('project_id', projectId)
      .eq('contract_type', 'material_purchase')
      .eq('status', 'confirmed');
    
    if (error) throw error;
    
    return data?.map(c => ({
      id: c.id,
      contract_no: c.contract_no,
      supplier_name: c.party_b?.[0]?.name || ''
    })) || [];
  }
};

export default purchaseOrderApi;
