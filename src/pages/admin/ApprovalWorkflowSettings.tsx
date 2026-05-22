import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FaSave, FaTrash, FaPlus } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { APPROVAL_SOURCE_TYPE_LABELS } from '../../constants/approvalRoles';
import {
  listAllApprovalSteps,
  updateApprovalStepSignType,
  listApprovalConditions,
  saveApprovalCondition,
  deleteApprovalCondition,
  listApprovalSlaConfig,
  updateApprovalSla,
  type ApprovalStepRow,
  type ApprovalConditionRow,
  type ApprovalSlaRow,
} from '../../services/approvalAdminService';
import { SegmentedControl, SearchableSelect } from '../../components/ui';
import ResponsiveTable from '../../components/ResponsiveTable';

type SettingsTab = 'steps' | 'conditions' | 'sla';

const SIGN_OPTIONS = [
  { value: 'normal', label: '普通' },
  { value: 'orsign', label: '或签' },
  { value: 'countersign', label: '会签' },
];

const OPERATOR_OPTIONS = [
  { value: 'lt', label: '小于' },
  { value: 'lte', label: '小于等于' },
  { value: 'gte', label: '大于等于' },
  { value: 'gt', label: '大于' },
];

export default function ApprovalWorkflowSettings() {
  const { isStrictSuperAdmin } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('steps');
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<ApprovalStepRow[]>([]);
  const [conditions, setConditions] = useState<ApprovalConditionRow[]>([]);
  const [slaRows, setSlaRows] = useState<ApprovalSlaRow[]>([]);
  const [filterType, setFilterType] = useState('');
  const [condForm, setCondForm] = useState({
    id: '',
    source_type: 'income_variation',
    field_name: 'variation_amount',
    operator: 'lt' as 'lt' | 'lte' | 'gte' | 'gt',
    threshold_value: 100000,
    max_step_order: 3,
    description: '',
  });

  const sourceTypeOptions = useMemo(
    () => [
      { value: '', label: '全部业务' },
      ...Object.entries(APPROVAL_SOURCE_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    ],
    [],
  );

  async function refresh() {
    setLoading(true);
    try {
      const [s, c, sla] = await Promise.all([
        listAllApprovalSteps(),
        listApprovalConditions(),
        listApprovalSlaConfig(),
      ]);
      setSteps(s);
      setConditions(c);
      setSlaRows(sla);
    } catch (e) {
      alert((e as Error).message || '加载失败');
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filteredSteps = filterType
    ? steps.filter((s) => s.source_type === filterType)
    : steps;

  if (!isStrictSuperAdmin) {
    return (
      <div className="p-8 text-center text-gray-500">
        仅超级管理员可配置审批流程
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-gray-800">审批流程配置</h3>
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as SettingsTab)}
          options={[
            { value: 'steps', label: '步骤签批' },
            { value: 'conditions', label: '金额条件' },
            { value: 'sla', label: 'SLA 时效' },
          ]}
        />
      </div>

      <p className="text-sm text-gray-500">
        修改后立即生效。金额条件影响变更签证等业务的有效审批步骤；邮件通知写入
        approval_email_queue，需运维配置发信通道。
      </p>

      {tab === 'steps' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="max-w-xs">
            <label className="ui-label">筛选业务类型</label>
            <SearchableSelect
              value={filterType}
              onChange={setFilterType}
              options={sourceTypeOptions}
              placeholder="全部"
            />
          </div>
          {loading ? (
            <p className="text-gray-500">加载中…</p>
          ) : (
            <ResponsiveTable
              columns={[
                {
                  key: 'source_type',
                  label: '业务类型',
                  render: (v) => APPROVAL_SOURCE_TYPE_LABELS[String(v)] || String(v),
                },
                { key: 'step_order', label: '步骤' },
                { key: 'step_name', label: '步骤名称' },
                { key: 'approver_role', label: '审批岗位' },
                {
                  key: 'sign_type',
                  label: '签批方式',
                  render: (_v, row) => (
                    <SegmentedControl
                      value={(row as ApprovalStepRow).sign_type || 'normal'}
                      onChange={(v) => {
                        void updateApprovalStepSignType(
                          (row as ApprovalStepRow).id,
                          v as 'normal' | 'orsign' | 'countersign',
                        ).then(refresh);
                      }}
                      options={SIGN_OPTIONS}
                    />
                  ),
                },
              ]}
              data={filteredSteps}
              keyField="id"
              emptyTitle="暂无步骤配置"
            />
          )}
        </div>
      )}

      {tab === 'conditions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h4 className="font-medium text-gray-800 mb-3">新增 / 编辑条件</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="ui-label">业务类型</label>
                <SearchableSelect
                  value={condForm.source_type}
                  onChange={(v) => setCondForm((f) => ({ ...f, source_type: v }))}
                  options={sourceTypeOptions.filter((o) => o.value)}
                />
              </div>
              <div>
                <label className="ui-label">字段名</label>
                <input
                  className="ui-input w-full"
                  value={condForm.field_name}
                  onChange={(e) => setCondForm((f) => ({ ...f, field_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="ui-label">运算符</label>
                <SegmentedControl
                  value={condForm.operator}
                  onChange={(v) =>
                    setCondForm((f) => ({ ...f, operator: v as typeof f.operator }))
                  }
                  options={OPERATOR_OPTIONS}
                />
              </div>
              <div>
                <label className="ui-label">阈值</label>
                <input
                  type="number"
                  className="ui-input w-full"
                  value={condForm.threshold_value}
                  onChange={(e) =>
                    setCondForm((f) => ({
                      ...f,
                      threshold_value: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="ui-label">条件成立时最多走到步骤</label>
                <input
                  type="number"
                  className="ui-input w-full"
                  value={condForm.max_step_order}
                  onChange={(e) =>
                    setCondForm((f) => ({ ...f, max_step_order: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <label className="ui-label">说明</label>
                <input
                  className="ui-input w-full"
                  value={condForm.description}
                  onChange={(e) => setCondForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <button
              type="button"
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
              onClick={() => {
                void saveApprovalCondition(condForm).then(() => {
                  setCondForm((f) => ({ ...f, id: '' }));
                  void refresh();
                });
              }}
            >
              <FaSave /> 保存条件
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <ResponsiveTable
              columns={[
                {
                  key: 'source_type',
                  label: '业务',
                  render: (v) => APPROVAL_SOURCE_TYPE_LABELS[String(v)] || String(v),
                },
                { key: 'field_name', label: '字段' },
                { key: 'operator', label: '运算' },
                { key: 'threshold_value', label: '阈值' },
                { key: 'max_step_order', label: '最多步骤' },
                { key: 'description', label: '说明' },
                {
                  key: 'id',
                  label: '操作',
                  render: (_v, row) => (
                    <button
                      type="button"
                      className="text-red-600 text-sm flex items-center gap-1"
                      onClick={() => {
                        if (!confirm('确定删除该条件？')) return;
                        void deleteApprovalCondition((row as ApprovalConditionRow).id).then(
                          refresh,
                        );
                      }}
                    >
                      <FaTrash /> 删除
                    </button>
                  ),
                },
              ]}
              data={conditions}
              keyField="id"
              emptyTitle="暂无条件规则"
            />
          </div>
        </div>
      )}

      {tab === 'sla' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {loading ? (
            <p className="text-gray-500">加载中…</p>
          ) : (
            <ResponsiveTable
              columns={[
                {
                  key: 'source_type',
                  label: '业务',
                  render: (v) => APPROVAL_SOURCE_TYPE_LABELS[String(v)] || String(v),
                },
                { key: 'step_order', label: '步骤' },
                {
                  key: 'sla_hours',
                  label: 'SLA(小时)',
                  render: (v, row) => (
                    <input
                      type="number"
                      className="ui-input w-24"
                      defaultValue={Number(v)}
                      onBlur={(e) => {
                        const sla = Number(e.target.value);
                        const remind =
                          (row as ApprovalSlaRow).remind_before_hours || 24;
                        void updateApprovalSla((row as ApprovalSlaRow).id, sla, remind);
                      }}
                    />
                  ),
                },
                {
                  key: 'remind_before_hours',
                  label: '提前提醒(h)',
                  render: (v, row) => (
                    <input
                      type="number"
                      className="ui-input w-24"
                      defaultValue={Number(v)}
                      onBlur={(e) => {
                        const remind = Number(e.target.value);
                        const sla = (row as ApprovalSlaRow).sla_hours;
                        void updateApprovalSla((row as ApprovalSlaRow).id, sla, remind);
                      }}
                    />
                  ),
                },
              ]}
              data={slaRows}
              keyField="id"
              emptyTitle="暂无 SLA 配置（请先执行 phase4 迁移）"
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
