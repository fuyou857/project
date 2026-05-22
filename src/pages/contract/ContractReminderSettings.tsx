import { useState, useEffect } from 'react';
import {
  FaCog,
  FaSave,
  FaPlus,
  FaTrash,
  FaBell,
  FaCalendar,
  FaDollarSign,
  FaFlag,
  FaCheck,
  FaTimes,
  FaEdit } from
'react-icons/fa';
import {
  createReminderRule,
  updateReminderRule,
  deleteReminderRule,
  getReminderRules,
  type ReminderRule } from
'../../services/contractReminderService';
import { SearchableSelect, SegmentedControl } from '../../components/ui';
import type {
  ReminderType,
  ReminderChannel,
  ReminderLevel } from
'../../types';

const REMINDER_TYPE_LABELS: Record<ReminderType, string> = {
  contract_expiry: '合同到期提醒',
  payment_due: '付款节点提醒',
  milestone: '里程碑提醒'
};

const REMINDER_LEVEL_LABELS: Record<ReminderLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急'
};

const REMINDER_CHANNEL_LABELS: Record<ReminderChannel, string> = {
  system: '系统消息',
  wechat_work: '企业微信'
};

export default function ContractReminderSettings() {
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'global' | 'contract'>('global');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);

  const [formData, setFormData] = useState({
    reminder_type: 'contract_expiry' as ReminderType,
    days_before: 30,
    channels: ['system'] as ReminderChannel[],
    level: 'medium' as ReminderLevel,
    is_active: true
  });

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    setLoading(true);
    try {
      const data = await getReminderRules();
      setRules(data);
    } catch (error) {
      console.error('获取提醒规则失败:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRule() {
    try {
      if (editingRule) {
        await updateReminderRule(editingRule.id, formData);
      } else {
        await createReminderRule({
          ...formData,
          contract_id: null,
          contract_type: null
        });
      }
      setShowAddModal(false);
      setEditingRule(null);
      setFormData({
        reminder_type: 'contract_expiry',
        days_before: 30,
        channels: ['system'],
        level: 'medium',
        is_active: true
      });
      await fetchRules();
    } catch (error) {
      console.error('保存提醒规则失败:', error);
      alert('保存失败，请重试');
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('确定要删除这条提醒规则吗？')) return;
    try {
      await deleteReminderRule(id);
      await fetchRules();
    } catch (error) {
      console.error('删除提醒规则失败:', error);
      alert('删除失败，请重试');
    }
  }

  function handleEditRule(rule: ReminderRule) {
    setEditingRule(rule);
    setFormData({
      reminder_type: rule.reminder_type,
      days_before: rule.days_before,
      channels: rule.channels,
      level: rule.level,
      is_active: rule.is_active
    });
    setShowAddModal(true);
  }

  const globalRules = rules.filter((r) => !r.contract_id);

  return (
    <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FaCog className="text-blue-600" />
                    提醒规则设置
                </h3>
                <button
          onClick={() => {
            setEditingRule(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
          
                    <FaPlus /> 添加规则
                </button>
            </div>

            <div className="flex gap-4">
                <button
          onClick={() => setActiveTab('global')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          activeTab === 'global' ?
          'bg-blue-600 text-white' :
          'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
          }>
          
                    全局规则
                </button>
                <button
          onClick={() => setActiveTab('contract')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          activeTab === 'contract' ?
          'bg-blue-600 text-white' :
          'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
          }>
          
                    合同专属规则
                </button>
            </div>

            {activeTab === 'global' &&
      <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <FaBell className="text-blue-600" />
                        全局提醒规则
                    </h4>

                    {(() => {if (loading) {return (
              <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                            <p className="mt-2 text-gray-500">加载中...</p>
                        </div>);} else {if (
            globalRules.length === 0) {return (
                <div className="text-center py-8">
                            <FaCog className="mx-auto text-gray-300 text-4xl" />
                            <p className="mt-2 text-gray-500">暂无全局提醒规则</p>
                            <button
                    onClick={() => {
                      setEditingRule(null);
                      setShowAddModal(true);
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
                    
                                添加第一条规则
                            </button>
                        </div>);} else {return (

                <div className="space-y-4">
                            {globalRules.map((rule) =>
                  <div
                    key={rule.id}
                    className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                    
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                {rule.reminder_type === 'contract_expiry' &&
                          <FaCalendar className="text-blue-600" />
                          }
                                                {rule.reminder_type === 'payment_due' &&
                          <FaDollarSign className="text-green-600" />
                          }
                                                {rule.reminder_type === 'milestone' &&
                          <FaFlag className="text-purple-600" />
                          }
                                                <span className="font-semibold text-gray-800">
                                                    {REMINDER_TYPE_LABELS[rule.reminder_type] ?? String(rule.reminder_type)}
                                                </span>
                                                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                          rule.is_active ?
                          'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-600'}`
                          }>
                                                    {rule.is_active ? '启用' : '禁用'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <p className="text-gray-500">提前提醒</p>
                                                    <p className="font-medium text-gray-800">{rule.days_before}天</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500">提醒级别</p>
                                                    <p className="font-medium text-gray-800">{REMINDER_LEVEL_LABELS[rule.level] ?? rule.level}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500">推送渠道</p>
                                                    <p className="font-medium text-gray-800">
                                                        {rule.channels.map((c) => REMINDER_CHANNEL_LABELS[c] ?? c).join('、')}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500">创建时间</p>
                                                    <p className="font-medium text-gray-800">
                                                        {new Date(rule.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                          onClick={() => handleEditRule(rule)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg">
                          
                                                <FaEdit className="w-5 h-5" />
                                            </button>
                                            <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg">
                          
                                                <FaTrash className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                  )}
                        </div>);}}})()
        }
                </div>
      }

            {activeTab === 'contract' &&
      <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <div className="text-center py-12">
                        <FaBell className="mx-auto text-gray-300 text-6xl" />
                        <p className="mt-4 text-gray-500">合同专属规则功能即将上线</p>
                        <p className="text-sm text-gray-400 mt-2">目前仅支持全局规则设置</p>
                    </div>
                </div>
      }

            {showAddModal &&
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={() => {
          setShowAddModal(false);
          setEditingRule(null);
        }}>
        
                    <div
          className="bg-white rounded-xl p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}>
          
                        <h3 className="text-lg font-bold text-gray-800 mb-4">
                            {editingRule ? '编辑提醒规则' : '添加提醒规则'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-2">提醒类型 *</label>
                                <SearchableSelect
                allowEmpty={false}
                value={formData.reminder_type}
                onChange={(v) => setFormData({ ...formData, reminder_type: v as ReminderType })}
                options={[
                { value: 'contract_expiry', label: REMINDER_TYPE_LABELS.contract_expiry },
                { value: 'payment_due', label: REMINDER_TYPE_LABELS.payment_due },
                { value: 'milestone', label: REMINDER_TYPE_LABELS.milestone }]
                }
                placeholder="选择类型"
                searchThreshold={10}
                metricsContext="page:contract_reminder_settings:rule_type" />
              
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-2">提前提醒天数 *</label>
                                <input
                type="number"
                min="1"
                max="90"
                value={formData.days_before}
                onChange={(e) => setFormData({ ...formData, days_before: parseInt(e.target.value) || 30 })}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" />
              
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-2">提醒级别</label>
                                <SegmentedControl
                value={formData.level}
                onChange={(v) => setFormData({ ...formData, level: v as ReminderLevel })}
                options={[
                { value: 'low', label: REMINDER_LEVEL_LABELS.low },
                { value: 'medium', label: REMINDER_LEVEL_LABELS.medium },
                { value: 'high', label: REMINDER_LEVEL_LABELS.high },
                { value: 'urgent', label: REMINDER_LEVEL_LABELS.urgent }]
                }
                metricsContext="page:contract_reminder_settings:rule_level"
                aria-label="提醒级别" />
              
                            </div>

                            <div>
                                <label className="block text-sm text-gray-600 mb-2">推送渠道</label>
                                <div className="space-y-2">
                                    {Object.entries(REMINDER_CHANNEL_LABELS).map(([key, label]) =>
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                                            <input
                    type="checkbox"
                    checked={formData.channels.includes(key as ReminderChannel)}
                    onChange={() => {
                      const channels = formData.channels.includes(key as ReminderChannel) ?
                      formData.channels.filter((c) => c !== key) :
                      [...formData.channels, key as ReminderChannel];
                      setFormData({ ...formData, channels });
                    }}
                    className="w-4 h-4 text-blue-600 rounded" />
                  
                                            <span className="text-gray-700">{label}</span>
                                        </label>
                )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">启用状态</span>
                                <button
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={`p-2 rounded-lg transition-colors ${
                formData.is_active ? 'bg-blue-600' : 'bg-gray-300'}`
                }>
                
                                    {formData.is_active ?
                <FaCheck className="text-white" /> :

                <FaTimes className="text-gray-600" />
                }
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingRule(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
              
                                取消
                            </button>
                            <button
              onClick={handleSaveRule}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
              
                                <FaSave /> 保存
                            </button>
                        </div>
                    </div>
                </div>
      }
        </div>);

}