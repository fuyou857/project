import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaTimes, FaEdit, FaTrash, FaCheck, FaShieldAlt, FaExclamationTriangle } from 'react-icons/fa';
import { supabase } from '../../supabase/client';
import { getPermissionAssignGroups } from '../../config/navMenuDefinition';
import { canonicalizePermissions } from '../../config/menuAccess';
import { addLog, logModule, logAction } from '../../services/logService';
import { useSingleToast } from '../../hooks/useSingleToast';
import SingleToastBanner from '../../components/ui/SingleToastBanner';

interface Role {id: string;name: string;code: string;description: string;permissions: string[];is_system: boolean;created_at?: string;}

function GroupSelectCheckbox({
  keys,
  selectedPerms,
  onSetKeys




}: {keys: string[];selectedPerms: string[];onSetKeys: (keys: string[], select: boolean) => void;}) {
  const ref = useRef<HTMLInputElement>(null);
  const allOn = keys.every((k) => selectedPerms.includes(k));
  const someOn = keys.some((k) => selectedPerms.includes(k));
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someOn && !allOn;
  }, [someOn, allOn]);

  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none shrink-0">
      <input
        ref={ref}
        type="checkbox"
        checked={allOn}
        onChange={() => onSetKeys(keys, !allOn)}
        className="rounded border-slate-500 text-blue-600 focus:ring-blue-500" />
      
      <span>全选本组</span>
    </label>);

}

export default function RoleManagement() {
  const { toast, showToast } = useSingleToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPermModal, setShowPermModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  // 须随菜单源更新；勿用 [] 固定首次挂载快照，否则热更新或发版后弹窗仍缺「合同模板库」等项
  const { permissionMenuGroups, allPermissionKeys, groupKeysByGroup, tasksInjected } = useMemo(() => {
    const { groups, tasksInjected } = getPermissionAssignGroups();
    const allPermissionKeys = [...new Set(groups.flatMap((g) => g.items.map((i) => i.key)))];
    const groupKeysByGroup = groups.map((g) => g.items.map((i) => i.key));
    return { permissionMenuGroups: groups, allPermissionKeys, groupKeysByGroup, tasksInjected };
  }, [showPermModal]);

  const isSuperAdmin = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'super_admin' || user.role_ids?.includes('super_admin');
  };

  useEffect(() => {fetchRoles();}, []);

  async function fetchRoles() {
    setLoading(true);
    const { data, error } = await supabase.from('roles').select('*').order('created_at', { ascending: false });
    if (error) {showToast('error', '加载角色失败');}
    if (data) {
      const mappedRoles = data.map((r) => ({
        id: r.id as string,
        name: r.name || r['名称'],
        code: r.code || r['代码'] || r.name || r['名称'],
        description: r.description || r['描述'],
        permissions: r.permissions || [],
        is_system: r.is_system || false,
        created_at: r.created_at
      }));
      setRoles(mappedRoles);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingRole?.code === 'admin') {showToast('error', '超级管理员角色不可修改');return;}
    try {
      if (editingRole) {
        const { error } = await supabase.from('roles').update(formData).eq('id', editingRole.id);
        if (error) throw error;
        showToast('success', '角色更新成功');
      } else {
        const { error } = await supabase.from('roles').insert({ ...formData, permissions: [], is_system: false });
        if (error) throw error;
        showToast('success', '角色创建成功');
      }
      setShowModal(false);setFormData({ name: '', code: '', description: '' });setEditingRole(null);fetchRoles();
    } catch {showToast('error', '操作失败');}
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.code === 'admin') {showToast('error', '超级管理员角色不可删除');setShowDeleteModal(false);return;}
    try {
      const { error } = await supabase.from('roles').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      await addLog(logModule.USER, logAction.DELETE, `删除角色：${deleteTarget.name}`, { role_id: deleteTarget.id });
      showToast('success', '角色删除成功');
      setShowDeleteModal(false);setDeleteTarget(null);fetchRoles();
    } catch {showToast('error', '删除失败');}
  }

  async function handleSavePerms() {
    if (!editingRole) return;
    if (editingRole.code === 'admin') {showToast('error', '超级管理员权限不可修改');return;}
    try {
      const normalized = canonicalizePermissions(selectedPerms);
      const { error } = await supabase.from('roles').update({ permissions: normalized }).eq('id', editingRole.id);
      if (error) throw error;
      await addLog(
        logModule.USER,
        logAction.CHANGE_ROLE,
        `分配权限：角色「${editingRole.name}」，权限项 ${normalized.length} 个`,
        { role_id: editingRole.id, permission_count: normalized.length }
      );
      showToast('success', '权限保存成功');
      window.dispatchEvent(new Event('app:role-permissions-changed'));
      setShowPermModal(false);fetchRoles();
    } catch {showToast('error', '保存失败');}
  }

  const openEdit = (role: Role) => {
    if (role.code === 'admin') {showToast('error', '超级管理员角色不可修改');return;}
    setEditingRole(role);
    setFormData({ name: role.name, code: role.code, description: role.description });
    setShowModal(true);
  };

  const openPerms = (role: Role) => {
    setEditingRole(role);
    setSelectedPerms(canonicalizePermissions(role.permissions || []));
    setShowPermModal(true);
  };

  const confirmDelete = (role: Role) => {
    if (role.code === 'admin') {showToast('error', '超级管理员角色不可删除');return;}
    setDeleteTarget(role);
    setShowDeleteModal(true);
  };

  const togglePerm = (perm: string) => {
    setSelectedPerms((prev) => prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]);
  };

  const setKeysSelected = (keys: string[], select: boolean) => {
    setSelectedPerms((prev) => {
      const s = new Set(prev);
      for (const k of keys) {
        if (select) s.add(k);else
        s.delete(k);
      }
      return [...s];
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {toast && <SingleToastBanner type={toast.type} message={toast.message} />}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">角色权限</h3>
        <button onClick={() => {setEditingRole(null);setFormData({ name: '', code: '', description: '' });setShowModal(true);}} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-gray-800 rounded-lg"><FaPlus /> 新增角色</button>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h4 className="text-gray-800 font-medium mb-4">角色列表</h4>
        {(() => {if (loading) {return <div className="text-slate-500 text-center py-8">加载中...</div>;} else {if (roles.length === 0) {return <div className="text-slate-500 text-center py-8">暂无角色</div>;} else {return (
                <div className="space-y-2">
            {roles.map((r) =>
                  <div key={r.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FaShieldAlt className="text-blue-400" />
                  <div>
                    <div className="text-gray-800 font-medium">{r.name} <span className="text-slate-500 text-sm">({r.code})</span></div>
                    <div className="text-gray-500 text-sm">{r.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${r.is_system || r.code === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>{(() => {if (r.code === 'admin') {return '超级管理员';} else {if (r.is_system) {return '系统角色';} else {return '自定义';}}})()}</span>
                  {r.code !== 'admin' &&
                      <>
                      <button onClick={() => openEdit(r)} className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg"><FaEdit /></button>
                      {isSuperAdmin() && <button onClick={() => confirmDelete(r)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"><FaTrash /></button>}
                    </>
                      }
                  <button onClick={() => openPerms(r)} className="px-3 py-1 bg-green-600 text-gray-800 text-sm rounded-lg">分配权限</button>
                </div>
              </div>
                  )}
          </div>);}}})()
        }
      </div>

      <AnimatePresence>
        {showModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-gray-800">{editingRole ? '编辑角色' : '新增角色'}</h3><button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(false); }} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm text-gray-500 mb-2">角色名称 *</label><input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                <div><label className="block text-sm text-gray-500 mb-2">角色标识 *</label><input type="text" required value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} disabled={!!editingRole} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800 disabled:opacity-50" /></div>
                <div><label className="block text-sm text-gray-500 mb-2">描述</label><input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-600 rounded-lg text-gray-800" /></div>
                <div className="flex justify-end gap-3 pt-4"><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(false); }} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button><button type="submit" className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">{editingRole ? '保存' : '新增'}</button></div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showPermModal && editingRole &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPermModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-bold text-gray-800">分配权限 - {editingRole.name}</h3>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowPermModal(false); }} className="p-2 text-gray-500 hover:text-gray-800 shrink-0" aria-label="关闭">
                      <FaTimes />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">「全选本组」勾选当前行（模块）下全部功能；「全选所有」勾选全部行。</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    权限模块 {permissionMenuGroups.length} 个
                    {tasksInjected ? '（任务管理为内置补全，请重新构建前端以同步菜单源文件）' : '（任务管理来自菜单配置）'}
                  </p>
                  {(editingRole.code === 'admin' || editingRole.name === '超级管理员') &&
                <p className="text-xs text-amber-700 mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      超级管理员角色拥有全部功能权限，无需在此勾选；下表与侧栏菜单一致（含「任务管理」），仅作权限键与菜单对照参考。「保存权限」不会修改本角色。
                    </p>
                }
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                  type="button"
                  onClick={() => setKeysSelected(allPermissionKeys, true)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                  
                    全选所有
                  </button>
                  <button
                  type="button"
                  onClick={() => setKeysSelected(allPermissionKeys, false)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                  
                    清空全部
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {permissionMenuGroups.map((group, gi) =>
              <div key={group.path} className="border border-slate-600 rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="text-gray-800 font-medium">{group.name}</div>
                      <GroupSelectCheckbox
                    keys={groupKeysByGroup[gi]}
                    selectedPerms={selectedPerms}
                    onSetKeys={setKeysSelected} />
                  
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) =>
                  <label key={item.key} className={`flex items-center gap-2 px-3 py-1 rounded cursor-pointer ${selectedPerms.includes(item.key) ? 'bg-blue-600 text-gray-800' : 'bg-gray-50 text-gray-700'}`}>
                          <input type="checkbox" checked={selectedPerms.includes(item.key)} onChange={() => togglePerm(item.key)} className="hidden" />
                          <FaCheck className={`w-3 h-3 ${selectedPerms.includes(item.key) ? 'opacity-100' : 'opacity-0'}`} />
                          {item.label}
                        </label>
                  )}
                    </div>
                  </div>
              )}
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
                <button onClick={() => setShowPermModal(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                <button onClick={handleSavePerms} className="px-4 py-2 bg-blue-600 text-gray-800 rounded-lg">保存权限</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && deleteTarget &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-white rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4"><FaExclamationTriangle className="text-yellow-400 w-6 h-6" /><h3 className="text-xl font-bold text-gray-800">确认删除</h3></div>
              <p className="text-gray-700 mb-6">确定要删除角色 <span className="text-gray-800 font-medium">{deleteTarget.name}</span> 吗？此操作不可恢复。</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-500 text-gray-800 rounded-lg">取消</button>
                <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-gray-800 rounded-lg">确认删除</button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}