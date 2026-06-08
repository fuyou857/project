import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaTimes, FaPlus, FaUserFriends } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { ProjectFormData, ProjectErrors, PartyA } from './types';

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
  memberUserOptions?: ProjectMemberUserOption[];
  saving: boolean;
  onClose: () => void;
  onChange: (form: ProjectFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onPartyARefresh: () => void;
  onErrorsChange: (errors: ProjectErrors) => void;
}

interface QuickAddPartyAProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (id: string, name: string) => void;
}

function validateRequired(value: string | null | undefined, fieldName: string): string | null {
  if (!value || value.trim() === '') return `${fieldName}不能为空`;
  return null;
}

function QuickAddPartyAModal({ show, onClose, onSuccess }: QuickAddPartyAProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('party_a')
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      onSuccess(data.id, data.name);
      setName('');
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
      onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-800">快速新增甲方单位</h3>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="text-gray-400 hover:text-gray-600">
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
              autoFocus
              className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              取消
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg disabled:opacity-50 hover:bg-blue-700">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
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
  onPartyARefresh,
  onErrorsChange
}: ProjectFormProps) {
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
      onClick={(e) => { e.stopPropagation(); onClose(); }}>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-800">{editing ? '编辑项目' : '新增项目'}</h3>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="text-gray-400 hover:text-gray-600 p-2">
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
                <label className="block text-sm text-gray-600 mb-2">开工时间<span className="text-red-500 ml-1">*</span></label>
                <input
                  type="date"
                  value={form.start_date || ''}
                  onChange={(e) => onChange({ ...form, start_date: e.target.value })}
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 " + (errors.start_date ? 'border-red-500' : 'border-gray-300')} />

                {errors.start_date && <p className="text-red-500 text-xs mt-1">{errors.start_date}</p>}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-2">合同竣工时间</label>
                <input
                  type="date"
                  value={form.end_date || ''}
                  onChange={(e) => onChange({ ...form, end_date: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />

                {errors.end_date && <p className="text-red-500 text-xs mt-1">{errors.end_date}</p>}
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h4 className="text-gray-800 font-medium mb-4">二、甲方信息</h4>
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
                  placeholder="搜索或选择甲方单位…"
                  className={"w-full px-4 py-2 bg-white border rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-20 " + (errors.party_a_id ? 'border-red-500' : 'border-gray-300')} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowQuickAddPartyA(true);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded text-sm flex items-center gap-1">
                  <FaPlus className="text-xs" />
                  新增
                </button>
                {showPartyADropdown && filteredPartyA.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredPartyA.map((partyA) => (
                      <div
                        key={partyA.id}
                        onClick={() => {
                          onChange({ ...form, party_a_id: partyA.id });
                          setPartyASearch(partyA.name);
                          setShowPartyADropdown(false);
                          const { party_a_id, ...rest } = errors;
                          onErrorsChange(rest);
                        }}
                        className="px-4 py-2 cursor-pointer hover:bg-gray-50 text-gray-800">
                        {partyA.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {errors.party_a_id && <p className="text-red-500 text-xs mt-1">{errors.party_a_id}</p>}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
            <h4 className="text-gray-800 font-medium mb-4 flex items-center gap-2">
              <FaUserFriends className="text-blue-500" />
              三、项目成员（可选）
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
                  {memberUserOptions
                    .filter((u) => {
                      if (!memberSearch.trim()) return true;
                      const q = memberSearch.toLowerCase();
                      return (
                        (u.real_name || '').toLowerCase().includes(q) ||
                        (u.email || '').toLowerCase().includes(q));

                    })
                    .map((u) => {
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
                              if (e.target.checked) {
                                ids.add(u.id);
                              } else {
                                ids.delete(u.id);
                              }
                              onChange({
                                ...form,
                                member_user_ids: Array.from(ids)
                              });
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{u.real_name || '未命名用户'}</p>
                            <p className="text-xs text-gray-500 truncate">{u.email || '未设置邮箱'}</p>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
              取消
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg disabled:opacity-50 hover:bg-blue-700">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>

        <QuickAddPartyAModal
          show={showQuickAddPartyA}
          onClose={() => setShowQuickAddPartyA(false)}
          onSuccess={handleQuickAddPartyA} />
      </motion.div>
    </motion.div>
  );
}
