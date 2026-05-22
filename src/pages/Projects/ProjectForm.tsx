import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaTimes, FaUpload, FaPlus, FaUserFriends } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { SegmentedControl } from '../../components/ui';
import { ProjectFormData, ProjectErrors, PartyA, calcEndDate, calcManagementFee } from './types';

export interface ProjectMemberUserOption {
  id: string;
  real_name: string | null;
  email: string | null;
}

interface ProjectFormProps {
  show: boolean;
  editing: ProjectFormData | null;
  form: ProjectFormData;
  errors: ProjectErrors;
  partyAList: PartyA[];
  /** 可选：系统用户列表，用于选择项目成员 */
  memberUserOptions?: ProjectMemberUserOption[];
  saving: boolean;
  onClose: () => void;
  onChange: (form: ProjectFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onManagerIdCardUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStampAuthUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPartyARefresh: () => void;
  onErrorsChange: (errors: ProjectErrors) => void;
}

interface QuickAddPartyAProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (id: string, name: string) => void;
}

function validatePhone(phone: string | null | undefined): string | null {
  if (!phone || phone.trim() === '') return null;
  if (!/^1\d{10}$/.test(phone)) return '手机号格式不正确（需为11位数字，1开头）';
  return null;
}

function validateEmail(email: string | null | undefined): string | null {
  if (!email || email.trim() === '') return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
  return null;
}

function validateAmount(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined) return null;
  if (amount <= 0) return '金额必须大于0';
  return null;
}

function validateRequired(value: string | null | undefined, fieldName: string): string | null {
  if (!value || value.trim() === '') return `${fieldName}不能为空`;
  return null;
}

function QuickAddPartyAModal({ show, onClose, onSuccess }: QuickAddPartyAProps) {
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState('construction');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.
      from('party_a').
      insert({ name, unit_type: unitType, contact_person: contact, contact_phone: phone }).
      select().
      single();
      if (error) throw error;
      onSuccess(data.id, data.name);
      setName('');
      setUnitType('construction');
      setContact('');
      setPhone('');
      onClose();
    } catch (err: any) {
      alert('添加失败：' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
      onClick={onClose}>
      
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">快速新增甲方单位</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">单位名称<span className="text-red-500 ml-1">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required />
            
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">单位类别</label>
            <SegmentedControl
              value={unitType}
              onChange={setUnitType}
              options={[
              { value: 'construction', label: '建设单位' },
              { value: 'general', label: '总包单位' },
              { value: 'subcontract', label: '分包单位' }]
              }
              metricsContext="page:project_form:quick_add_party_a_unit_type"
              aria-label="单位类别" />
            
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">联系人</label>
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-2">电话</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              取消
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg disabled:opacity-50 hover:bg-blue-700">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>);

}

export default function ProjectForm({
  show,
  editing,
  form,
  errors,
  partyAList,
  memberUserOptions = [],
  saving,
  onClose,
  onChange,
  onSubmit,
  onManagerIdCardUpload,
  onStampAuthUpload,
  onPartyARefresh,
  onErrorsChange
}: ProjectFormProps) {
  const managerIdCardInputRef = useRef<HTMLInputElement>(null);
  const stampAuthInputRef = useRef<HTMLInputElement>(null);
  const [partyASearch, setPartyASearch] = useState('');
  const [showPartyADropdown, setShowPartyADropdown] = useState(false);
  const [filteredPartyA, setFilteredPartyA] = useState<PartyA[]>([]);
  const [showQuickAddPartyA, setShowQuickAddPartyA] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    if (partyASearch) {
      const filtered = partyAList.filter((p) =>
      p.name.toLowerCase().includes(partyASearch.toLowerCase())
      );
      setFilteredPartyA(filtered);
    } else {
      setFilteredPartyA(partyAList.slice(0, 10));
    }
  }, [partyASearch, partyAList]);

  useEffect(() => {
    const selected = partyAList.find((p) => p.id === form.party_a_id);
    if (selected) {
      setPartyASearch(selected.name);
    }
  }, [form.party_a_id, partyAList]);

  const handleDurationChange = (days: number) => {
    onChange({
      ...form,
      duration: days,
      end_date: calcEndDate(form.start_date ?? '', days)
    });
  };

  const handleStartDateChange = (startDate: string) => {
    onChange({
      ...form,
      start_date: startDate,
      end_date: calcEndDate(startDate, form.duration || 0)
    });
  };

  const handleFeeRateChange = (rate: number) => {
    onChange({
      ...form,
      management_fee_rate: rate,
      management_fee_amount: calcManagementFee(form.bid_amount || 0, rate)
    });
  };

  const handleBidAmountChange = (amount: number) => {
    onChange({
      ...form,
      bid_amount: amount,
      management_fee_amount: calcManagementFee(amount, form.management_fee_rate || 0)
    });
  };

  const handleQuickAddPartyA = async (id: string, name: string) => {
    onChange({ ...form, party_a_id: id });
    setPartyASearch(name);
    onPartyARefresh();
  };

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-4 sm:py-8"
      onClick={onClose}>
      
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">{editing ? '编辑项目' : '新增项目'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h4 className="text-gray-800 font-medium mb-4">一、基本信息</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm text-gray-600 mb-2">项目编号<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="text"
                  value={form.project_code || ''}
                  onChange={(e) => onChange({ ...form, project_code: e.target.value })}
                  onBlur={() => {
                    const err = validateRequired(form.project_code, '项目编号');
                    if (err) {
                      onErrorsChange({ ...errors, project_code: err });
                    } else {
                      const { project_code, ...rest } = errors;
                      onErrorsChange(rest);
                    }
                  }}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.project_code ? 'border-red-500' : 'border-gray-300')} />
                
                {errors.project_code && <p className="text-red-500 text-xs mt-1">{errors.project_code}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">项目名称<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="text"
                  value={form.name || ''}
                  onChange={(e) => onChange({ ...form, name: e.target.value })}
                  onBlur={() => {
                    const err = validateRequired(form.name, '项目名称');
                    if (err) {
                      onErrorsChange({ ...errors, name: err });
                    } else {
                      const { name, ...rest } = errors;
                      onErrorsChange(rest);
                    }
                  }}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.name ? 'border-red-500' : 'border-gray-300')} />
                
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div>
                <label className="block text-sm text-gray-600 mb-2">项目金额（元）<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="number"
                  value={form.bid_amount || ''}
                  onChange={(e) => handleBidAmountChange(Number(e.target.value))}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.bid_amount ? 'border-red-500' : 'border-gray-300')} />
                
                {errors.bid_amount && <p className="text-red-400 text-xs mt-1">{errors.bid_amount}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">项目工期（天）<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="number"
                  value={form.duration || ''}
                  onChange={(e) => handleDurationChange(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                
                {errors.duration && <p className="text-red-500 text-xs mt-1">{errors.duration}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div>
                <label className="block text-sm text-gray-600 mb-2">开工时间<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="date"
                  value={form.start_date || ''}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.start_date ? 'border-red-500' : 'border-gray-300')} />
                
                {errors.start_date && <p className="text-red-500 text-xs mt-1">{errors.start_date}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">合同竣工时间<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="date"
                  value={form.end_date || ''}
                  onChange={(e) => onChange({ ...form, end_date: e.target.value })}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.end_date ? 'border-red-500' : 'border-gray-300')} />
                
                {errors.end_date && <p className="text-red-500 text-xs mt-1">{errors.end_date}</p>}
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h4 className="text-gray-800 font-medium mb-4 flex items-center gap-2">
              <FaUserFriends className="text-blue-500" />
              二、项目成员（可选）
            </h4>
            <p className="text-sm text-gray-600 mb-3">从系统用户中点选参与本项目的成员，用于协作与权限关联（可选）。</p>
            {memberUserOptions.length === 0 ?
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">暂无可选用户，请确认用户管理中有本公司账号。</p> :

            <>
                <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="搜索姓名或邮箱…"
                className="w-full px-4 py-2 mb-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white p-3 space-y-2">
                  {memberUserOptions.
                filter((u) => {
                  if (!memberSearch.trim()) return true;
                  const q = memberSearch.toLowerCase();
                  return (
                    (u.real_name || '').toLowerCase().includes(q) ||
                    (u.email || '').toLowerCase().includes(q));

                }).
                map((u) => {
                  const checked = (form.member_user_ids || []).includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 cursor-pointer text-gray-800">
                      
                          <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const ids = new Set(form.member_user_ids || []);
                          if (e.target.checked) ids.add(u.id);else
                          ids.delete(u.id);
                          onChange({ ...form, member_user_ids: [...ids] });
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      
                          <span className="flex-1">
                            <span className="font-medium">{u.real_name || '未命名'}</span>
                            <span className="text-gray-500 text-sm ml-2">{u.email || ''}</span>
                          </span>
                        </label>);

                })}
                </div>
                <p className="text-xs text-gray-500 mt-2">已选 {(form.member_user_ids || []).length} 人</p>
              </>
            }
          </div>

          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h4 className="text-gray-800 font-medium mb-4">三、招标方式</h4>
            <div>
              <label className="block text-sm text-gray-600 mb-2">招标方式<span className="text-red-500 ml-1">*</span></label>
              <div className={errors.tender_method ? 'rounded-lg p-0.5 ring-2 ring-red-500' : ''}>
                <SegmentedControl
                  value={form.tender_method ?? 'public_tender'}
                  onChange={(v) => onChange({ ...form, tender_method: v })}
                  options={[
                  { value: 'public_tender', label: '公开招标' },
                  { value: 'direct_contract', label: '直签合同' }]
                  }
                  metricsContext="page:project_form:tender_method"
                  aria-label="招标方式" />
                
              </div>
              {errors.tender_method && <p className="text-red-500 text-xs mt-1">{errors.tender_method}</p>}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h4 className="text-gray-800 font-medium mb-4">四、费用信息</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm text-gray-600 mb-2">管理费比例（%）</label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.01"
                    value={form.management_fee_rate || ''}
                    onChange={(e) => handleFeeRateChange(Number(e.target.value))}
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-r-none" />
                  
                  <div className="px-4 py-2 bg-gray-200 border border-gray-300 rounded-lg text-gray-700 rounded-l-none flex items-center border-l-0">%</div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">成本票比例（%）</label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.01"
                    value={form.cost_ticket_rate || ''}
                    onChange={(e) => onChange({ ...form, cost_ticket_rate: Number(e.target.value) })}
                    className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-r-none" />
                  
                  <div className="px-4 py-2 bg-gray-200 border border-gray-300 rounded-lg text-gray-700 rounded-l-none flex items-center border-l-0">%</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div>
                <label className="block text-sm text-gray-600 mb-2">管理费金额<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="number"
                  value={form.management_fee_amount || ''}
                  readOnly
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 cursor-not-allowed" />
                
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">综合税率（%）<span className="text-red-500 ml-1">*</span></label>
                <div className="flex">
                  <input
                    type="number"
                    step="0.01"
                    value={form.tax_rate || ''}
                    onChange={(e) => onChange({ ...form, tax_rate: Number(e.target.value) })}
                    className={"flex-1 px-4 py-2 bg-white border rounded-lg text-gray-800 rounded-r-none focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.tax_rate ? 'border-red-500' : 'border-gray-300')} />
                  
                  <div className="px-4 py-2 bg-gray-200 border border-gray-300 rounded-lg text-gray-700 rounded-l-none flex items-center border-l-0">%</div>
                </div>
                {errors.tax_rate && <p className="text-red-500 text-xs mt-1">{errors.tax_rate}</p>}
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h4 className="text-gray-800 font-medium mb-4">五、项目负责人与盖章人信息</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm text-gray-600 mb-2">项目负责人<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="text"
                  value={form.project_manager || ''}
                  onChange={(e) => onChange({ ...form, project_manager: e.target.value })}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.project_manager ? 'border-red-500' : 'border-gray-300')} />
                
                {errors.project_manager && <p className="text-red-500 text-xs mt-1">{errors.project_manager}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">项目负责人电话<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="text"
                  value={form.manager_phone || ''}
                  onChange={(e) => onChange({ ...form, manager_phone: e.target.value })}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.manager_phone ? 'border-red-500' : 'border-gray-300')} />
                
                {errors.manager_phone && <p className="text-red-500 text-xs mt-1">{errors.manager_phone}</p>}
              </div>
            </div>
            <div className="mt-5">
              <label className="block text-sm text-gray-600 mb-2">项目负责人身份证<span className="text-red-500 ml-1">*</span></label>
              <input
                type="file"
                ref={managerIdCardInputRef}
                accept="image/*,.pdf"
                onChange={onManagerIdCardUpload}
                className="hidden" />
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => managerIdCardInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
                  
                  <FaUpload className="inline mr-2" /> 上传文件
                </button>
                {form.manager_id_card_url && <span className="text-green-500 text-sm">✓ 已上传</span>}
              </div>
              {errors.manager_id_card_url && <p className="text-red-500 text-xs mt-1">{errors.manager_id_card_url}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div>
                <label className="block text-sm text-gray-600 mb-2">项目盖章人<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="text"
                  value={form.stamp_person || ''}
                  onChange={(e) => onChange({ ...form, stamp_person: e.target.value })}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.stamp_person ? 'border-red-500' : 'border-gray-300')} />
                
                {errors.stamp_person && <p className="text-red-500 text-xs mt-1">{errors.stamp_person}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">项目盖章人电话<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="text"
                  value={form.stamp_person_phone || ''}
                  onChange={(e) => onChange({ ...form, stamp_person_phone: e.target.value })}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.stamp_person_phone ? 'border-red-500' : 'border-gray-300')} />
                
                {errors.stamp_person_phone && <p className="text-red-500 text-xs mt-1">{errors.stamp_person_phone}</p>}
              </div>
            </div>
            <div className="mt-5">
              <label className="block text-sm text-gray-600 mb-2">盖章人委托书附件<span className="text-red-500 ml-1">*</span></label>
              <input
                type="file"
                ref={stampAuthInputRef}
                accept="image/*,.pdf"
                onChange={onStampAuthUpload}
                className="hidden" />
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => stampAuthInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg">
                  
                  <FaUpload className="inline mr-2" /> 上传文件
                </button>
                {form.stamp_authorization_url && <span className="text-green-500 text-sm">✓ 已上传</span>}
              </div>
              {errors.stamp_authorization_url && <p className="text-red-500 text-xs mt-1">{errors.stamp_authorization_url}</p>}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h4 className="text-gray-800 font-medium mb-4">五、建设单位</h4>
            <div>
              <label className="block text-sm text-gray-600 mb-2">建设单位<span className="text-red-500 ml-1">*</span></label>
              <div className="relative">
                <input
                  type="text"
                  value={partyASearch}
                  onChange={(e) => {
                    setPartyASearch(e.target.value);
                    setShowPartyADropdown(true);
                  }}
                  onFocus={() => setShowPartyADropdown(true)}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.party_a_id ? 'border-red-500' : 'border-gray-300')}
                  placeholder="搜索建设单位..." />
                
                {showPartyADropdown &&
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg max-h-40 overflow-y-auto shadow-lg">
                    {filteredPartyA.length === 0 ?
                  <div className="p-3 text-gray-500 text-sm">未找到匹配的建设单位</div> :

                  filteredPartyA.map((p) =>
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange({ ...form, party_a_id: p.id });
                      setPartyASearch(p.name);
                      setShowPartyADropdown(false);
                    }}
                    className={"w-full text-left px-4 py-2 text-sm " + (form.party_a_id === p.id ? 'bg-blue-600 text-gray-800' : 'text-gray-700 hover:bg-gray-100')}>
                    
                          {p.name}
                        </button>
                  )
                  }
                    <button
                    type="button"
                    onClick={() => {setShowPartyADropdown(false);setShowQuickAddPartyA(true);}}
                    className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-100 border-t border-gray-200 flex items-center gap-2">
                    
                      <FaPlus className="w-3 h-3" /> 快速新增甲方单位
                    </button>
                  </div>
                }
              </div>
              {errors.party_a_id && <p className="text-red-500 text-xs mt-1">{errors.party_a_id}</p>}
            </div>
            <div className="mt-5">
              <label className="block text-sm text-gray-600 mb-2">建设单位联系人</label>
              <input
                type="text"
                value={form.party_a_contact || ''}
                onChange={(e) => onChange({ ...form, party_a_contact: e.target.value })}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h4 className="text-gray-800 font-medium mb-4">六、项目状态</h4>
            <div>
              <label className="block text-sm text-gray-600 mb-2">状态</label>
              <SegmentedControl
                value={form.status ?? 'not_started'}
                onChange={(v) => onChange({ ...form, status: v })}
                options={[
                { value: 'not_started', label: '未开工' },
                { value: 'in_progress', label: '进行中' },
                { value: 'completed', label: '已完工' }]
                }
                metricsContext="page:project_form:project_status"
                aria-label="项目状态" />
              
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg disabled:opacity-50 hover:bg-blue-700">
              
              {(() => {if (saving) {return '保存中...';} else {if (editing) {return '保存';} else {return '新增';}}})()}
            </button>
          </div>
        </form>
        <QuickAddPartyAModal
          show={showQuickAddPartyA}
          onClose={() => setShowQuickAddPartyA(false)}
          onSuccess={handleQuickAddPartyA} />
        
      </motion.div>
    </motion.div>);

}