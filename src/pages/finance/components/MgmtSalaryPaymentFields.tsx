import { useEffect, useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaUpload, FaExclamationTriangle } from 'react-icons/fa';
import { supabase } from '../../../supabase/client';

export interface StaffSalaryLine {
  staff_id: string;
  full_name: string;
  position_title?: string | null;
  selected: boolean;
  arrears_wage: string;
  current_pay: string;
  deduction: string;
  deduction_reason: string;
  deduction_attachment_url: string;
}

interface Props {
  projectId: string;
  lines: StaffSalaryLine[];
  setLines: Dispatch<SetStateAction<StaffSalaryLine[]>>;
}

export async function uploadPaymentAttachment(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `payment_mgmt_salary/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from('files').upload(path, file, { contentType: file.type || undefined });
  if (error) {
    console.error(error);
    return null;
  }
  const { data } = supabase.storage.from('files').getPublicUrl(path);
  return data.publicUrl;
}

export function linesToMetadata(lines: StaffSalaryLine[]) {
  const selected = lines.filter((l) => l.selected);
  return {
    mgmt_salary: true,
    lines: selected.map((l) => ({
      staff_id: l.staff_id,
      full_name: l.full_name,
      arrears_wage: Number(l.arrears_wage) || 0,
      current_pay: Number(l.current_pay) || 0,
      deduction: Number(l.deduction) || 0,
      deduction_reason: l.deduction_reason.trim(),
      deduction_attachment_url: l.deduction_attachment_url || ''
    }))
  };
}

export function metadataToLines(meta: unknown, fallbackNames: Map<string, string>): StaffSalaryLine[] {
  if (!meta || typeof meta !== 'object') return [];
  const m = meta as {mgmt_salary?: boolean;lines?: Array<Record<string, unknown>>;};
  if (!m.lines?.length) return [];
  return m.lines.map((row) => {
    const sid = String(row.staff_id ?? '');
    return {
      staff_id: sid,
      full_name: String(row.full_name ?? fallbackNames.get(sid) ?? ''),
      position_title: null,
      selected: true,
      arrears_wage: row.arrears_wage !== undefined && row.arrears_wage !== null ? String(row.arrears_wage) : '',
      current_pay: row.current_pay !== undefined && row.current_pay !== null ? String(row.current_pay) : '',
      deduction: row.deduction !== undefined && row.deduction !== null ? String(row.deduction) : '0',
      deduction_reason: String(row.deduction_reason ?? ''),
      deduction_attachment_url: String(row.deduction_attachment_url ?? '')
    };
  });
}

export function sumSelectedCurrentPay(lines: StaffSalaryLine[]): number {
  return lines.filter((l) => l.selected).reduce((s, l) => s + (Number(l.current_pay) || 0), 0);
}

export function validateMgmtSalaryLines(lines: StaffSalaryLine[]): string | null {
  const selected = lines.filter((l) => l.selected);
  if (selected.length === 0) return '请至少选择一名管理人员';
  let total = 0;
  for (const l of selected) {
    total += Number(l.current_pay) || 0;
    const ded = Number(l.deduction);
    if (Number.isNaN(ded)) continue;
    if (ded > 0) {
      if (!l.deduction_reason?.trim()) return `管理人员「${l.full_name}」考核奖励（正数）须填写考核奖励说明`;
    }
    if (ded < 0) {
      if (!l.deduction_reason?.trim()) return `管理人员「${l.full_name}」考核扣减（负数）须填写考核扣减说明`;
      if (!l.deduction_attachment_url?.trim()) return `管理人员「${l.full_name}」考核扣减（负数）须上传考核附件`;
    }
  }
  if (total <= 0) return '本次发放工资合计须大于 0';
  return null;
}

export default function MgmtSalaryPaymentFields({ projectId, lines, setLines }: Props) {
  const [loading, setLoading] = useState(false);
  /** 正数：考核奖励说明（仅文字）；负数：考核扣减说明（文字 + 必传附件） */
  const [adjustModal, setAdjustModal] = useState<{
    staffId: string;
    mode: 'reward' | 'deduction';
    reason: string;
    uploading: boolean;
  } | null>(null);

  const loadStaff = useCallback(async () => {
    if (!projectId) {
      setLines([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.
    from('project_mgmt_staff').
    select('id, full_name, position_title').
    eq('project_id', projectId).
    order('full_name', { ascending: true });
    setLoading(false);
    if (error) return;
    if (!data?.length) {
      setLines([]);
      return;
    }
    setLines((prev) => {
      const existingById = new Map(prev.map((l) => [l.staff_id, l]));
      return data.map((s) => {
        const old = existingById.get(s.id);
        if (old) return { ...old, full_name: s.full_name, position_title: s.position_title };
        return {
          staff_id: s.id,
          full_name: s.full_name,
          position_title: s.position_title,
          selected: false,
          arrears_wage: '',
          current_pay: '',
          deduction: '0',
          deduction_reason: '',
          deduction_attachment_url: ''
        };
      });
    });
  }, [projectId, setLines]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const updateLine = (staffId: string, patch: Partial<StaffSalaryLine>) => {
    setLines((prev) => prev.map((l) => l.staff_id === staffId ? { ...l, ...patch } : l));
  };

  const onDeductionChange = (staffId: string, value: string) => {
    setLines((prev) =>
    prev.map((l) => {
      if (l.staff_id !== staffId) return l;
      const prevNum = Number(l.deduction);
      const num = Number(value);
      const isZero = value === '' || num === 0;
      const fromNegToPos = !Number.isNaN(prevNum) && prevNum < 0 && !Number.isNaN(num) && num > 0;
      const fromPosToNeg = !Number.isNaN(prevNum) && prevNum > 0 && !Number.isNaN(num) && num < 0;
      const updated: StaffSalaryLine = {
        ...l,
        deduction: value,
        ...(isZero ? { deduction_reason: '', deduction_attachment_url: '' } : {}),
        ...(!isZero && !Number.isNaN(num) && num > 0 ? { deduction_attachment_url: '' } : {}),
        ...(fromNegToPos ? { deduction_reason: '' } : {}),
        ...(fromPosToNeg ? { deduction_reason: '', deduction_attachment_url: '' } : {})
      };
      if (value !== '' && !Number.isNaN(num)) {
        if (num > 0 && !updated.deduction_reason?.trim()) {
          setTimeout(
            () => setAdjustModal({ staffId, mode: 'reward', reason: updated.deduction_reason || '', uploading: false }),
            0
          );
        }
        if (num < 0 && (!updated.deduction_reason?.trim() || !updated.deduction_attachment_url?.trim())) {
          setTimeout(
            () => setAdjustModal({ staffId, mode: 'deduction', reason: updated.deduction_reason || '', uploading: false }),
            0
          );
        }
      }
      return updated;
    })
    );
  };

  const confirmAdjustModal = async (file?: File | null) => {
    if (!adjustModal) return;
    const line = lines.find((l) => l.staff_id === adjustModal.staffId);
    if (!line) {
      setAdjustModal(null);
      return;
    }
    if (!adjustModal.reason.trim()) {
      alert(adjustModal.mode === 'reward' ? '请填写考核奖励说明' : '请填写考核扣减说明');
      return;
    }
    if (adjustModal.mode === 'reward') {
      updateLine(adjustModal.staffId, {
        deduction_reason: adjustModal.reason.trim(),
        deduction_attachment_url: ''
      });
      setAdjustModal(null);
      return;
    }
    let url = line.deduction_attachment_url;
    if (file) {
      setAdjustModal((d) => d ? { ...d, uploading: true } : null);
      const uploaded = await uploadPaymentAttachment(file);
      setAdjustModal((d) => d ? { ...d, uploading: false } : null);
      if (!uploaded) {
        alert('附件上传失败，请重试');
        return;
      }
      url = uploaded;
    } else if (!url?.trim()) {
      alert('考核扣减（负数）须上传相关附件');
      return;
    }
    updateLine(adjustModal.staffId, {
      deduction_reason: adjustModal.reason.trim(),
      deduction_attachment_url: url
    });
    setAdjustModal(null);
  };

  if (!projectId) {
    return <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">请先选择项目。</p>;
  }

  if (loading) {
    return <div className="text-gray-500 py-4 text-center">加载管理人员名单…</div>;
  }

  if (lines.length === 0) {
    return (
      <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-2 items-start">
        <FaExclamationTriangle className="mt-0.5 shrink-0" />
        <span>当前项目在「基础数据 → 项目部管理人员」中暂无人员，请先在基础数据中维护该项目管理人员。</span>
      </div>);

  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        勾选参与本次工资发放的管理人员，并填写金额。「考核增减工资」默认为 0；<span className="text-green-700 font-medium">正数表示奖励</span>，填写后须完成
        <span className="font-medium">考核奖励说明</span>；<span className="text-red-700 font-medium">负数表示扣款</span>，须完成
        <span className="font-medium">考核扣减说明</span>并上传附件。
      </p>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-2 py-2 text-left w-10">选</th>
              <th className="px-2 py-2 text-left">姓名</th>
              <th className="px-2 py-2 text-left">岗位</th>
              <th className="px-2 py-2 text-right">拖欠工资</th>
              <th className="px-2 py-2 text-right">本次发放工资</th>
              <th className="px-2 py-2 text-right">考核增减工资</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) =>
            <tr key={l.staff_id} className="border-t border-gray-100 hover:bg-gray-50/80">
                <td className="px-2 py-2">
                  <input
                  type="checkbox"
                  checked={l.selected}
                  onChange={(e) => updateLine(l.staff_id, { selected: e.target.checked })}
                  className="rounded border-gray-300" />
                
                </td>
                <td className="px-2 py-2 text-gray-800">{l.full_name}</td>
                <td className="px-2 py-2 text-gray-600">{l.position_title || '—'}</td>
                <td className="px-2 py-2">
                  <input
                  type="number"
                  step="0.01"
                  disabled={!l.selected}
                  value={l.arrears_wage}
                  onChange={(e) => updateLine(l.staff_id, { arrears_wage: e.target.value })}
                  className="w-full min-w-[88px] px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-right text-gray-800 disabled:bg-gray-100" />
                
                </td>
                <td className="px-2 py-2">
                  <input
                  type="number"
                  step="0.01"
                  disabled={!l.selected}
                  value={l.current_pay}
                  onChange={(e) => updateLine(l.staff_id, { current_pay: e.target.value })}
                  className="w-full min-w-[88px] px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-right text-gray-800 disabled:bg-gray-100" />
                
                </td>
                <td className="px-2 py-2">
                  <input
                  type="number"
                  step="0.01"
                  disabled={!l.selected}
                  value={l.deduction}
                  onChange={(e) => onDeductionChange(l.staff_id, e.target.value)}
                  className="w-full min-w-[88px] px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-right text-gray-800 disabled:bg-gray-100" />
                
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {adjustModal &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setAdjustModal(null)}>
          
            <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}>
            
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-gray-800">
                  {adjustModal.mode === 'reward' ? '考核奖励说明' : '考核扣减说明'}
                </h4>
                <button type="button" onClick={() => setAdjustModal(null)} className="text-gray-500 hover:text-gray-800">
                  <FaTimes />
                </button>
              </div>
              {adjustModal.mode === 'reward' ?
            <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                  当前为考核奖励（正数），请填写奖励依据或说明。
                </p> :

            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  当前为考核扣款（负数），须填写扣减说明并上传考核相关附件。
                </p>
            }
              <label className="block text-sm text-gray-600 mb-1">
                {adjustModal.mode === 'reward' ? '考核奖励说明 *' : '考核扣减说明 *'}
              </label>
              <textarea
              value={adjustModal.reason}
              onChange={(e) => setAdjustModal((d) => d ? { ...d, reason: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-800 mb-4 resize-none"
              rows={3}
              placeholder={adjustModal.mode === 'reward' ? '请说明奖励依据、考核结果等' : '请说明扣减依据'} />
            
              {adjustModal.mode === 'deduction' &&
            <>
                  <label className="block text-sm text-gray-600 mb-1">考核附件 *</label>
                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 text-gray-600">
                    <FaUpload />
                    <span>选择文件</span>
                    <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,application/pdf,image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void confirmAdjustModal(file);
                    e.target.value = '';
                  }} />
                
                  </label>
                </>
            }
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setAdjustModal(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
                  取消
                </button>
                <button
                type="button"
                disabled={adjustModal.uploading}
                onClick={() => void confirmAdjustModal(null)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">
                
                  {(() => {if (adjustModal.uploading) {return '上传中…';} else {if (adjustModal.mode === 'reward') {return '确定';} else {return '保存（已有附件）';}}})()}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}