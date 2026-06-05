import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import SearchableSelect from '../ui/SearchableSelect';
import { MODAL_PANEL_MOTION } from '../ui/modalMotion';
import type { SubmitApprovalPlan, SubmitApprovalOpenConfig } from '../../services/approvalApproverService';
import type { ApprovalStepPlanRow } from '../../services/approvalApproverService';

type Props = {
  config: SubmitApprovalOpenConfig;
  title: string;
  onClose: () => void;
  onSubmit: (payload: {
    approvers: { stepOrder: number; approverId: string; approverName: string; isDefault: boolean }[];
    remark: string;
  }) => void | Promise<void>;
  loadPlan: () => Promise<SubmitApprovalPlan | null>;
};

export default function SubmitApprovalModal({
  config,
  title,
  onClose,
  onSubmit,
  loadPlan,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<SubmitApprovalPlan | null>(null);
  const [steps, setSteps] = useState<ApprovalStepPlanRow[]>([]);
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const p = await loadPlan();
        if (cancelled) return;
        if (!p) {
          setError('未配置审批流程，请联系管理员执行审批步骤迁移脚本');
          setPlan(null);
          return;
        }
        setPlan(p);
        setSteps(p.steps.map((s) => ({ ...s })));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载审批人失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPlan]);

  const adjustable = useMemo(() => steps.filter((s) => !s.isFixed), [steps]);

  function updateApprover(stepOrder: number, userId: string) {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.stepOrder !== stepOrder) return s;
        const cand = s.candidates.find((c) => c.userId === userId);
        return {
          ...s,
          approverId: userId,
          approverName: cand?.name || s.approverName,
          isDefault: cand?.isDefault ?? false,
        };
      }),
    );
  }

  async function handleConfirm() {
    if (!plan || steps.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit({
        approvers: steps
          .filter((s) => s.stepOrder > 1)
          .map((s) => ({
            stepOrder: s.stepOrder,
            approverId: s.approverId,
            approverName: s.approverName,
            isDefault: s.candidates.find((c) => c.userId === s.approverId)?.isDefault ?? false,
          })),
        remark: remark.trim(),
      });
    } catch (error) {
      console.error('提交审批失败:', error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <motion.div
          {...MODAL_PANEL_MOTION}
          className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="text-gray-500 hover:text-gray-800">
              <FaTimes />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {config.summaryRows && config.summaryRows.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">基本信息</h4>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm space-y-1">
                  {config.summaryRows.map((row) => (
                    <div key={row.label} className="flex gap-2">
                      <span className="text-gray-500 shrink-0">{row.label}：</span>
                      <span className="text-gray-800">{row.value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading && <p className="text-sm text-gray-500 text-center py-6">加载审批流程…</p>}
            {error && (
              <p className="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 p-3">{error}</p>
            )}

            {!loading && !error && plan && (
              <>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    审批流程（共 {steps.length} 步）
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {steps.map((s, idx) => (
                      <div
                        key={s.stepOrder}
                        className="flex items-center gap-1 text-xs text-gray-600"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-medium">
                          {idx + 1}
                        </span>
                        <span>{s.stepName}</span>
                        <span className="text-gray-800 font-medium">{s.approverName}</span>
                        {idx < steps.length - 1 && <span className="text-gray-300 mx-1">→</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {adjustable.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">审批人调整（可选）</h4>
                    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                      {adjustable.map((s) => (
                        <div key={s.stepOrder} className="grid grid-cols-[100px_1fr] gap-2 items-center">
                          <label className="text-sm text-gray-600">{s.stepName}</label>
                          <SearchableSelect
                            value={s.approverId}
                            onChange={(v) => updateApprover(s.stepOrder, v)}
                            options={s.candidates.map((c) => ({
                              value: c.userId,
                              label: c.name,
                            }))}
                            allowEmpty={false}
                            searchThreshold={4}
                            placeholder="选择审批人"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">审批说明（可选）</h4>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800"
                    placeholder="请尽快审批，谢谢！"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="button"
              disabled={loading || !!error || !plan || submitting}
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {submitting ? '提交中…' : '提交审批'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
