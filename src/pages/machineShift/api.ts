/**
 * 机械台班管理 API 调用
 */

import { supabase } from '../../supabase/client';
import type {
  MachineShiftRecord,
  MachineShiftFormData,
  MachineShiftFilter,
  MachineShiftStatistics,
  MachineStatistics,
  TimeStatistics,
  RentalContract,
  DrillDownRecord,
} from './types';

const MACHINE_SHIFT_API = '/supabase/functions/v1/machine-shift';

async function callMachineShiftAPI(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetch(`${MACHINE_SHIFT_API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API 调用失败');
  }

  return data;
}

// 分页查询台班记录
export async function fetchMachineShiftRecords(
  filter: MachineShiftFilter = {}
): Promise<{
  data: MachineShiftRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const params = new URLSearchParams();
  
  if (filter.projectId) params.append('projectId', filter.projectId);
  if (filter.machineId) params.append('machineId', filter.machineId);
  if (filter.status) params.append('status', filter.status);
  if (filter.dateFrom) params.append('dateFrom', filter.dateFrom);
  if (filter.dateTo) params.append('dateTo', filter.dateTo);
  params.append('page', String(filter.page || 1));
  params.append('pageSize', String(filter.pageSize || 20));

  const result = await callMachineShiftAPI(`/records?${params.toString()}`);
  return result;
}

// 新增单条台班记录
export async function createMachineShiftRecord(
  data: MachineShiftFormData,
  userId?: string
): Promise<MachineShiftRecord> {
  const result = await callMachineShiftAPI('/records', {
    method: 'POST',
    body: JSON.stringify({ ...data, created_by: userId }),
  });
  return result.data;
}

// 批量新增台班记录
export async function batchCreateMachineShiftRecords(
  records: MachineShiftFormData[],
  userId?: string
): Promise<MachineShiftRecord[]> {
  const result = await callMachineShiftAPI('/records/batch', {
    method: 'POST',
    body: JSON.stringify({ records, created_by: userId }),
  });
  return result.data;
}

// 修改台班记录
export async function updateMachineShiftRecord(
  id: string,
  data: Partial<MachineShiftFormData & { status?: string }>
): Promise<MachineShiftRecord> {
  const result = await callMachineShiftAPI(`/records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return result.data;
}

// 删除台班记录
export async function deleteMachineShiftRecord(id: string): Promise<void> {
  await callMachineShiftAPI(`/records/${id}`, {
    method: 'DELETE',
  });
}

// 穿透明细数据
export async function fetchDrillDownRecords(
  filter: MachineShiftFilter
): Promise<{
  data: DrillDownRecord[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const params = new URLSearchParams();
  
  if (filter.projectId) params.append('projectId', filter.projectId);
  if (filter.machineId) params.append('machineId', filter.machineId);
  if (filter.status) params.append('status', filter.status);
  if (filter.dateFrom) params.append('dateFrom', filter.dateFrom);
  if (filter.dateTo) params.append('dateTo', filter.dateTo);
  params.append('page', String(filter.page || 1));
  params.append('pageSize', String(filter.pageSize || 20));

  const result = await callMachineShiftAPI(`/records/drill-down?${params.toString()}`);
  return result;
}

// 按项目归集统计
export async function fetchProjectStatistics(
  projectId: string,
  month?: string
): Promise<MachineShiftStatistics> {
  const params = new URLSearchParams();
  if (month) params.append('month', month);

  const result = await callMachineShiftAPI(
    `/statistics/project/${projectId}${params.toString() ? '?' + params.toString() : ''}`
  );
  return result.data;
}

// 按机械归集统计
export async function fetchMachineStatistics(
  machineId: string
): Promise<MachineStatistics> {
  const result = await callMachineShiftAPI(`/statistics/machine/${machineId}`);
  return result.data;
}

// 按时间范围汇总
export async function fetchTimeStatistics(
  type: 'daily' | 'monthly',
  dateFrom?: string,
  dateTo?: string,
  projectId?: string
): Promise<TimeStatistics> {
  const params = new URLSearchParams();
  params.append('type', type);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  if (projectId) params.append('projectId', projectId);

  const result = await callMachineShiftAPI(`/statistics/time?${params.toString()}`);
  return result.data;
}

// 获取项目的机械租赁合同列表
export async function fetchRentalContracts(projectId: string): Promise<RentalContract[]> {
  const result = await callMachineShiftAPI(`/contracts/${projectId}`);
  return result.data || [];
}

// 上传台班图片
export async function uploadMachineShiftImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('files')
    .upload(`machine-shift/${fileName}`, file, {
      contentType: file.type,
      cacheControl: '3600',
    });

  if (uploadError) {
    throw new Error(`上传失败: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('files').getPublicUrl(`machine-shift/${fileName}`);
  return data.publicUrl;
}
