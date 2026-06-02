import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaSearch,
  FaCheck,
  FaTimes,
  FaClock,
  FaUser,
  FaBell,
  FaExternalLinkAlt,
  FaDownload,
  FaUserFriends,
} from 'react-icons/fa';
import {
  getPendingApprovals,
  getMyInitiatedApprovals,
  getApprovalSteps,
  approve,
  reject,
  withdrawApproval,
  canWithdrawApproval,
  getApprovalHistory,
  getSourceTypeLabel,
} from '../../services/approvalService';
import {
  sendApprovalReminder,
  batchApprove,
  listOpinionTemplates,
  saveOpinionTemplate,
  deleteOpinionTemplate,
  getApprovalDashboardStats,
  buildApprovalExportRows,
  getApprovalDiscussionComments,
  addApprovalDiscussionComment,
  notifyMentionedUsers,
  type OpinionTemplate,
  type ApprovalDashboardStats,
} from '../../services/approvalPhase3Service';
import { BATCH_APPROVABLE_SOURCE_TYPES } from '../../constants/approvalPhase3';
import { approvalSourceListPath } from '../../utils/approvalSourceLink';
import { downloadJsonRowsAsXlsx } from '../../utils/excelSheet';
import { getStoredUser } from '../../utils/sessionUser';
import { supabase } from '../../supabase/client';
import { Modal } from '../../components/Modal';
import { SegmentedControl } from '../../components/ui';
import ApprovalDashboardPanel from '../../components/approval/ApprovalDashboardPanel';
import ApprovalDelegationModal from '../../components/approval/ApprovalDelegationModal';

interface ApprovalItem {
  id: string;
  source_type: string;
  source_id: string;
  source_name: string;
  current_step: number;
  status: string;
  created_at: string;
  created_by?: string;
}

function refreshApprovalBadges() {
  window.dispatchEvent(new Event('approval-pending-refresh'));
}

interface ApprovalRecord {
  step_name: string;
  approver_name: string;
  action: string;
  comment: string;
  created_at: string;
}

type MainTab = 'pending' | 'initiated' | 'dashboard';

export default function ApprovalCenter() {
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalItem | null>(null);
  const [approvalSteps, setApprovalSteps] = useState<{ id: string; step_order: number; step_name: string }[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [discussionComments, setDiscussionComments] = useState<
    { author_name: string; content: string; created_at: string; mentioned_user_ids?: string[] }[]
  >([]);
  const [showDetail, setShowDetail] = useState(false);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [stepNameByKey, setStepNameByKey] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<MainTab>('pending');
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchComment, setBatchComment] = useState('批量审批通过');
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<ApprovalDashboardStats | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [templates, setTemplates] = useState<OpinionTemplate[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState({ title: '', content: '' });
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [userOptions, setUserOptions] = useState<
    { id: string; real_name?: string; username?: string }[]
  >([]);
  const [mentionUserIds, setMentionUserIds] = useState<string[]>([]);
  const [discussionText, setDiscussionText] = useState('');

  const user = getStoredUser();

  const batchableSet = useMemo(() => new Set<string>(BATCH_APPROVABLE_SOURCE_TYPES), []);

  useEffect(() => {
    void supabase
      .from('users')
      .select('id, real_name, username')
      .order('real_name')
      .then(({ data }) => setUserOptions(data || []));
  }, []);

  useEffect(() => {
    if (user.id) void listOpinionTemplates(user.id).then(setTemplates).catch(console.error);
  }, [user.id]);

  useEffect(() => {
    setSelectedIds(new Set());
    if (tab === 'dashboard') {
      void loadDashboard();
    } else {
      void fetchApprovals();
    }
  }, [tab]);

  async function loadDashboard() {
    if (!user.id) return;
    setDashboardLoading(true);
    try {
      setDashboardStats(await getApprovalDashboardStats(user.id));
    } catch (e) {
      console.error(e);
    }
    setDashboardLoading(false);
  }

  async function loadStepNames(items: ApprovalItem[]) {
    const names: Record<string, string> = {};
    const types = [...new Set(items.map((a) => a.source_type))];
    await Promise.all(
      types.map(async (type) => {
        const steps = await getApprovalSteps(type);
        for (const s of steps || []) {
          names[`${type}:${s.step_order}`] = s.step_name;
        }
      }),
    );
    setStepNameByKey(names);
  }

  async function fetchApprovals() {
    setLoading(true);
    try {
      if (!user.id) {
        setApprovals([]);
        return;
      }
      const data =
        tab === 'pending'
          ? await getPendingApprovals(user.id)
          : await getMyInitiatedApprovals(user.id);
      setApprovals((data || []) as ApprovalItem[]);
      await loadStepNames((data || []) as ApprovalItem[]);
    } catch (error) {
      console.error('获取审批列表失败:', error);
    }
    setLoading(false);
  }

  async function openDetail(approval: ApprovalItem) {
    setSelectedApproval(approval);
    setComment('');
    setDiscussionText('');
    setMentionUserIds([]);
    const steps = await getApprovalSteps(approval.source_type);
    setApprovalSteps(steps);
    const history = await getApprovalHistory(approval.id);
    setApprovalHistory(history);
    const comments = await getApprovalDiscussionComments(approval.id);
    setDiscussionComments(comments);
    if (tab === 'initiated' && user.id && approval.status === 'pending') {
      setCanWithdraw(await canWithdrawApproval(approval.id, user.id));
    } else {
      setCanWithdraw(false);
    }
    setShowDetail(true);
  }

  const filteredApprovals = approvals.filter((item) =>
    item.source_name.toLowerCase().includes(search.toLowerCase()),
  );

  const allPendingBatchable =
    tab === 'pending' &&
    filteredApprovals.length > 0 &&
    filteredApprovals.every((a) => batchableSet.has(a.source_type));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredApprovals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApprovals.map((a) => a.id)));
    }
  };

  async function handleBatchApprove() {
    if (!user.id) return;
    setProcessing(true);
    try {
      await batchApprove([...selectedIds], user.id, approverDisplayName(), batchComment);
      setShowBatchConfirm(false);
      setSelectedIds(new Set());
      await fetchApprovals();
      refreshApprovalBadges();
    } catch (e) {
      alert((e as Error).message || '批量审批失败');
    }
    setProcessing(false);
  }

  async function handleUrge() {
    if (!selectedApproval || !user.id) return;
    if (!confirm('向当前审批人发送催办通知？')) return;
    setProcessing(true);
    try {
      await sendApprovalReminder(selectedApproval.id, user.id);
      alert('催办已发送');
    } catch (e) {
      alert((e as Error).message || '催办失败');
    }
    setProcessing(false);
  }

  async function handleExport() {
    if (!user.id) return;
    const exportTab = tab === 'initiated' ? 'initiated' : 'pending';
    const rows = await buildApprovalExportRows(user.id, exportTab);
    if (rows.length === 0) {
      alert('暂无数据可导出');
      return;
    }
    const name = exportTab === 'pending' ? '审批待办' : '我发起的审批';
    await downloadJsonRowsAsXlsx(rows, name, `${name}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function statusLabel(status: string) {
    if (status === 'pending') return '审批中';
    if (status === 'approved') return '已通过';
    if (status === 'rejected') return '已驳回';
    if (status === 'withdrawn') return '已撤回';
    return status;
  }

  function statusColor(status: string) {
    if (status === 'pending') return 'text-blue-600';
    if (status === 'approved') return 'text-green-600';
    if (status === 'rejected') return 'text-red-600';
    if (status === 'withdrawn') return 'text-gray-500';
    return 'text-gray-600';
  }

  function approverDisplayName() {
    return user.real_name || user.username || '审批人';
  }

  const currentStepInfo = useCallback(
    (approval: ApprovalItem) => {
      const cached = stepNameByKey[`${approval.source_type}:${approval.current_step}`];
      if (cached) return cached;
      const step = approvalSteps.find((s) => s.step_order === approval.current_step);
      return step?.step_name || `第${approval.current_step}步`;
    },
    [stepNameByKey, approvalSteps],
  );

  async function handleWithdraw() {
    if (!selectedApproval || !user.id) return;
    if (!confirm('确定撤回该审批申请？撤回后可修改业务单据并重新提交。')) return;
    setProcessing(true);
    try {
      await withdrawApproval(selectedApproval.id, user.id, approverDisplayName());
      setShowDetail(false);
      await fetchApprovals();
      refreshApprovalBadges();
    } catch (error) {
      alert((error as Error).message || '撤回失败');
    }
    setProcessing(false);
  }

  async function handleApprove() {
    if (!selectedApproval || !user.id) return;
    setProcessing(true);
    try {
      await approve(selectedApproval.id, user.id, approverDisplayName(), comment);
      if (mentionUserIds.length > 0) {
        await notifyMentionedUsers(
          selectedApproval as Parameters<typeof notifyMentionedUsers>[0],
          mentionUserIds,
          approverDisplayName(),
          comment,
        );
      }
      setShowDetail(false);
      setComment('');
      setConfirmAction(null);
      await fetchApprovals();
      refreshApprovalBadges();
    } catch (error) {
      alert((error as Error).message || '审批失败');
    }
    setProcessing(false);
  }

  async function handleReject() {
    if (!selectedApproval || !user.id) return;
    if (!comment.trim()) {
      alert('请填写驳回原因');
      return;
    }
    setProcessing(true);
    try {
      await reject(selectedApproval.id, user.id, approverDisplayName(), comment);
      if (mentionUserIds.length > 0) {
        await notifyMentionedUsers(
          selectedApproval as Parameters<typeof notifyMentionedUsers>[0],
          mentionUserIds,
          approverDisplayName(),
          comment,
        );
      }
      setShowDetail(false);
      setComment('');
      setConfirmAction(null);
      await fetchApprovals();
      refreshApprovalBadges();
    } catch (error) {
      alert((error as Error).message || '驳回失败');
    }
    setProcessing(false);
  }

  async function handlePostDiscussion() {
    if (!selectedApproval || !user.id) return;
    setProcessing(true);
    try {
      await addApprovalDiscussionComment(
        selectedApproval.id,
        user.id,
        approverDisplayName(),
        discussionText,
        mentionUserIds,
      );
      setDiscussionText('');
      setMentionUserIds([]);
      setDiscussionComments(await getApprovalDiscussionComments(selectedApproval.id));
    } catch (e) {
      alert((e as Error).message || '发送失败');
    }
    setProcessing(false);
  }

  async function handleSaveTemplate() {
    if (!user.id) return;
    try {
      await saveOpinionTemplate(user.id, templateForm);
      setTemplates(await listOpinionTemplates(user.id));
      setTemplateForm({ title: '', content: '' });
      setShowTemplateModal(false);
    } catch (e) {
      alert((e as Error).message || '保存失败');
    }
  }

  function openSourceList(sourceType: string) {
    const path = approvalSourceListPath(sourceType);
    if (path) navigate(path);
    else alert('暂未配置该业务的跳转路径');
  }

  const tabButtons: { key: MainTab; label: string }[] = [
    { key: 'pending', label: '我的待办' },
    { key: 'initiated', label: '我发起的' },
    { key: 'dashboard', label: '看板' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-gray-800">审批中心</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDelegationModal(true)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            <FaUserFriends /> 代理设置
          </button>
          {tab !== 'dashboard' && (
            <button
              type="button"
              onClick={() => void handleExport()}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"
            >
              <FaDownload /> 导出
            </button>
          )}
          <SegmentedControl
            value={tab}
            onChange={(v) => setTab(v as MainTab)}
            options={tabButtons.map((t) => ({ value: t.key, label: t.label }))}
          />
        </div>
      </div>

      {tab === 'dashboard' ? (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <ApprovalDashboardPanel stats={dashboardStats} loading={dashboardLoading} />
        </div>
      ) : (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="relative mb-4">
            <FaSearch className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="搜索审批事项..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800"
            />
          </div>

          {tab === 'pending' && filteredApprovals.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-gray-100">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === filteredApprovals.length && filteredApprovals.length > 0
                  }
                  onChange={toggleSelectAll}
                />
                全选
              </label>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  disabled={!allPendingBatchable}
                  title={
                    allPendingBatchable
                      ? undefined
                      : '仅扣款、产值、补充协议等同类型待办可批量通过'
                  }
                  onClick={() => setShowBatchConfirm(true)}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50"
                >
                  批量通过 ({selectedIds.size})
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-slate-500">加载中...</div>
          ) : filteredApprovals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              {tab === 'pending' ? '暂无待审批任务' : '暂无发起的审批'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApprovals.map((approval) => (
                <motion.div
                  key={approval.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {tab === 'pending' && (
                    <input
                      type="checkbox"
                      className="mr-3"
                      checked={selectedIds.has(approval.id)}
                      onChange={() => toggleSelect(approval.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <div
                    className="flex items-center gap-4 flex-1 cursor-pointer"
                    onClick={() => openDetail(approval)}
                  >
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <FaClock className="text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{approval.source_name}</div>
                      <div className="text-sm text-gray-500">
                        {getSourceTypeLabel(approval.source_type)}
                        {approval.status === 'pending'
                          ? ` · ${currentStepInfo(approval)}`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <div
                    className="text-right text-sm cursor-pointer"
                    onClick={() => openDetail(approval)}
                  >
                    <div className={statusColor(approval.status)}>{statusLabel(approval.status)}</div>
                    <div className="text-gray-400">
                      {new Date(approval.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showDetail && selectedApproval && (
          <Modal
            isOpen
            title={`审批详情 - ${selectedApproval.source_name}`}
            onClose={() => {
              setShowDetail(false);
              setComment('');
            }}
            size="lg"
          >
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openSourceList(selectedApproval.source_type)}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                >
                  <FaExternalLinkAlt /> 查看业务列表
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">类型</div>
                    <div className="text-gray-800 font-medium">
                      {getSourceTypeLabel(selectedApproval.source_type)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">当前步骤</div>
                    <div className="text-gray-800 font-medium">
                      {currentStepInfo(selectedApproval)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">创建时间</div>
                    <div className="text-gray-800">
                      {new Date(selectedApproval.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">状态</div>
                    <div className={`font-medium ${statusColor(selectedApproval.status)}`}>
                      {statusLabel(selectedApproval.status)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">审批进度</h4>
                <div className="space-y-2">
                  {approvalSteps.map((step, index) => {
                    const isCompleted = step.step_order < selectedApproval.current_step;
                    const isCurrent = step.step_order === selectedApproval.current_step;
                    let circleClass = 'bg-gray-200 text-gray-500';
                    if (isCompleted) circleClass = 'bg-green-600 text-white';
                    else if (isCurrent) circleClass = 'bg-blue-600 text-white';
                    let labelClass = 'text-gray-400';
                    if (isCompleted) labelClass = 'text-gray-500';
                    else if (isCurrent) labelClass = 'text-gray-800 font-medium';
                    return (
                      <div key={step.id} className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${circleClass}`}
                        >
                          {isCompleted ? <FaCheck /> : index + 1}
                        </div>
                        <div className={`flex-1 ${labelClass}`}>{step.step_name}</div>
                        {isCompleted && <div className="text-xs text-gray-400">已完成</div>}
                        {isCurrent && <div className="text-xs text-blue-400">处理中</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {approvalHistory.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">审批历史</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {approvalHistory.map((record, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="w-6 h-6 flex items-center justify-center text-xs">
                          {record.action === 'approve' || record.action === 'skip' ? (
                            <FaCheck className="text-green-600" />
                          ) : (
                            <FaTimes className="text-red-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">
                              {record.step_name}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                record.action === 'reject'
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-green-100 text-green-600'
                              }`}
                            >
                              {record.action === 'reject'
                                ? '驳回'
                                : record.action === 'skip'
                                  ? '自动跳过'
                                  : '通过'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <FaUser className="w-3 h-3" />
                            {record.approver_name} ·{' '}
                            {new Date(record.created_at).toLocaleString('zh-CN')}
                          </div>
                          {record.comment && (
                            <div className="text-sm text-gray-600 mt-1">
                              备注: {record.comment}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {discussionComments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">讨论</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {discussionComments.map((c, i) => (
                      <div key={i} className="text-sm p-2 bg-gray-50 rounded">
                        <span className="font-medium">{c.author_name}</span>
                        <span className="text-gray-400 text-xs ml-2">
                          {new Date(c.created_at).toLocaleString('zh-CN')}
                        </span>
                        <p className="text-gray-700 mt-1">{c.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">添加讨论 / @同事</h4>
                <textarea
                  value={discussionText}
                  onChange={(e) => setDiscussionText(e.target.value)}
                  placeholder="填写说明，可在下方勾选要通知的同事"
                  className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 resize-none"
                  rows={2}
                />
                <div className="mt-2 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {userOptions
                    .filter((u) => u.id !== user.id)
                    .slice(0, 20)
                    .map((u) => {
                      const checked = mentionUserIds.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className={`text-xs px-2 py-1 rounded border cursor-pointer ${
                            checked
                              ? 'bg-blue-100 border-blue-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mr-1"
                            checked={checked}
                            onChange={() => {
                              setMentionUserIds((prev) =>
                                checked ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                              );
                            }}
                          />
                          {u.real_name || u.username}
                        </label>
                      );
                    })}
                </div>
                <button
                  type="button"
                  disabled={processing || !discussionText.trim()}
                  onClick={() => void handlePostDiscussion()}
                  className="mt-2 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg disabled:opacity-50"
                >
                  发送讨论
                </button>
              </div>

              {tab === 'pending' && selectedApproval.status === 'pending' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">审批意见</h4>
                    <button
                      type="button"
                      className="text-xs text-blue-600"
                      onClick={() => setShowTemplateModal(true)}
                    >
                      管理意见模板
                    </button>
                  </div>
                  {templates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                          onClick={() => setComment(t.content)}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="通过时可填备注；驳回时必填原因"
                    className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    勾选上方同事可在通过/驳回时发送 @ 提醒
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetail(false);
                    setComment('');
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg"
                >
                  关闭
                </button>
                {tab === 'initiated' &&
                  selectedApproval.status === 'pending' &&
                  canWithdraw && (
                    <button
                      type="button"
                      onClick={() => void handleWithdraw()}
                      disabled={processing}
                      className="px-4 py-2 bg-amber-600 text-white rounded-lg disabled:opacity-50"
                    >
                      {processing ? '处理中…' : '撤回申请'}
                    </button>
                  )}
                {tab === 'initiated' && selectedApproval.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => void handleUrge()}
                    disabled={processing}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-1"
                  >
                    <FaBell /> 催办
                  </button>
                )}
                {tab === 'pending' && selectedApproval.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmAction('reject')}
                      disabled={processing}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
                    >
                      驳回
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmAction('approve')}
                      disabled={processing}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                    >
                      通过
                    </button>
                  </>
                )}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <Modal
        isOpen={confirmAction !== null}
        title={confirmAction === 'reject' ? '确认驳回' : '确认通过'}
        onClose={() => setConfirmAction(null)}
      >
        <p className="text-gray-700 mb-4">
          {confirmAction === 'reject'
            ? '确定驳回该审批？驳回原因将通知发起人。'
            : '确定通过当前审批步骤？'}
        </p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmAction(null)}
            className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirmAction === 'reject') void handleReject();
              else void handleApprove();
            }}
            disabled={processing}
            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
              confirmAction === 'reject' ? 'bg-red-600' : 'bg-blue-600'
            }`}
          >
            {processing ? '处理中…' : '确认'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showBatchConfirm}
        title="批量通过"
        onClose={() => setShowBatchConfirm(false)}
      >
        <p className="text-gray-700 mb-2">将一次性通过 {selectedIds.size} 条待办，请确认。</p>
        <textarea
          value={batchComment}
          onChange={(e) => setBatchComment(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
          rows={2}
        />
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowBatchConfirm(false)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg"
          >
            取消
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={() => void handleBatchApprove()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
          >
            {processing ? '处理中…' : '确认批量通过'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showTemplateModal}
        title="常用意见模板"
        onClose={() => setShowTemplateModal(false)}
      >
        <div className="space-y-3 mb-4">
          <input
            className="ui-input w-full"
            placeholder="模板标题"
            value={templateForm.title}
            onChange={(e) => setTemplateForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="模板内容"
            rows={3}
            value={templateForm.content}
            onChange={(e) => setTemplateForm((f) => ({ ...f, content: e.target.value }))}
          />
          <button
            type="button"
            onClick={() => void handleSaveTemplate()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            保存模板
          </button>
        </div>
        {templates.map((t) => (
          <div
            key={t.id}
            className="flex justify-between items-start p-3 bg-gray-50 rounded mb-2 text-sm"
          >
            <div>
              <div className="font-medium">{t.title}</div>
              <div className="text-gray-600">{t.content}</div>
            </div>
            <button
              type="button"
              className="text-red-600 text-xs"
              onClick={() => {
                if (!user.id) return;
                void deleteOpinionTemplate(user.id, t.id).then(() =>
                  listOpinionTemplates(user.id!).then(setTemplates),
                );
              }}
            >
              删除
            </button>
          </div>
        ))}
      </Modal>

      {user.id && (
        <ApprovalDelegationModal
          isOpen={showDelegationModal}
          onClose={() => setShowDelegationModal(false)}
          delegatorId={user.id}
          userOptions={userOptions}
        />
      )}
    </motion.div>
  );
}
