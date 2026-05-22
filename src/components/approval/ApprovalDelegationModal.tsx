import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { SearchableSelect } from '../ui';
import {
  listDelegations,
  saveDelegation,
  type ApprovalDelegation,
} from '../../services/approvalPhase3Service';
import { APPROVAL_SOURCE_TYPE_LABELS } from '../../constants/approvalRoles';

type UserOption = { id: string; real_name?: string; username?: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  delegatorId: string;
  userOptions: UserOption[];
};

export default function ApprovalDelegationModal({
  isOpen,
  onClose,
  delegatorId,
  userOptions,
}: Props) {
  const [list, setList] = useState<ApprovalDelegation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    delegate_id: '',
    source_type: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  });

  const delegateOptions = useMemo(
    () =>
      userOptions
        .filter((u) => u.id !== delegatorId)
        .map((u) => ({
          value: u.id,
          label: u.real_name || u.username || u.id,
        })),
    [userOptions, delegatorId],
  );

  const sourceTypeOptions = useMemo(
    () => [
      { value: '', label: '全部业务类型' },
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
      setList(await listDelegations(delegatorId));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (isOpen && delegatorId) void refresh();
  }, [isOpen, delegatorId]);

  async function handleSave() {
    if (!form.delegate_id) {
      alert('请选择代理人');
      return;
    }
    setSaving(true);
    try {
      await saveDelegation(delegatorId, {
        delegate_id: form.delegate_id,
        source_type: form.source_type || null,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      setForm((f) => ({ ...f, delegate_id: '' }));
      await refresh();
    } catch (e) {
      alert((e as Error).message || '保存失败');
    }
    setSaving(false);
  }

  return (
    <Modal isOpen={isOpen} title="代理审批设置" onClose={onClose} size="lg">
      <p className="text-sm text-gray-500 mb-4">
        休假期间可指定同事代您处理待办；代理人在有效期内可审批您岗位下的待办。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="ui-label">代理人</label>
          <SearchableSelect
            value={form.delegate_id}
            onChange={(v) => setForm((f) => ({ ...f, delegate_id: v }))}
            options={delegateOptions}
            placeholder="选择代理人"
          />
        </div>
        <div>
          <label className="ui-label">业务范围</label>
          <SearchableSelect
            value={form.source_type}
            onChange={(v) => setForm((f) => ({ ...f, source_type: v }))}
            options={sourceTypeOptions}
            placeholder="全部业务"
          />
        </div>
        <div>
          <label className="ui-label">开始日期</label>
          <input
            type="date"
            className="ui-input w-full"
            value={form.start_date}
            onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="ui-label">结束日期</label>
          <input
            type="date"
            className="ui-input w-full"
            value={form.end_date}
            onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
      >
        {saving ? '保存中…' : '添加代理'}
      </button>

      <h4 className="text-sm font-medium text-gray-700 mb-2">我的代理记录</h4>
      {loading ? (
        <p className="text-sm text-gray-500">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-gray-500">暂无代理配置</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {list.map((d) => {
            const delegate = userOptions.find((u) => u.id === d.delegate_id);
            const name = delegate?.real_name || delegate?.username || d.delegate_id;
            const typeLabel = d.source_type
              ? APPROVAL_SOURCE_TYPE_LABELS[d.source_type] || d.source_type
              : '全部业务';
            return (
              <div
                key={d.id}
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm"
              >
                <span className="text-gray-800">
                  {name} · {typeLabel} · {d.start_date} ~ {d.end_date}
                  {!d.is_active ? '（已停用）' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
