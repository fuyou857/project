import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaPlus, FaTimes, FaEdit, FaTrash, FaCheck, FaBan, FaSearch,
  FaBuilding, FaUserShield, FaProjectDiagram, FaKey, FaEnvelope,
  FaExclamationTriangle, FaClock } from
'react-icons/fa';
import {
  getUsers, getRoles, getCompanies, getProjects, createUser,
  updateUser, deleteUser as deleteUserApi, resetPassword, checkUserRelatedData,
  isSuperAdmin as checkSuperAdmin, type User, type Role, type Company, type Project } from
'../../services/userService';
import { useAuth } from '../../hooks/useAuth';
import { useSingleToast } from '../../hooks/useSingleToast';
import { errorMessageFromUnknown } from '../../utils/httpErrorMessage';
import SingleToastBanner from '../../components/ui/SingleToastBanner';
import ResponsiveTable from '../../components/ResponsiveTable';
import WechatWorkBindPanel from '../../components/admin/WechatWorkBindPanel';
import { SearchableSelect, SegmentedControl } from '../../components/ui';

const PAGE_SIZE = 15;

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [relatedDataWarning, setRelatedDataWarning] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    real_name: '',
    phone: '',
    email: '',
    company_id: '',
    role_id: '',
    project_ids: [] as string[],
    status: 'active' as 'active' | 'disabled'
  });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { toast, showToast } = useSingleToast();
  const [submitting, setSubmitting] = useState(false);

  const { user: currentUser, canEditUser, canDeleteUser, canResetPassword, canModifyRoles, loading: authLoading } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, companiesRes, rolesRes, projectsRes] = await Promise.all([
      getUsers(),
      getCompanies(),
      getRoles(),
      getProjects()]
      );

      setUsers(usersRes);
      setCompanies(companiesRes);
      setRoles(rolesRes);
      setProjects(projectsRes);
    } catch (error: unknown) {
      console.error('获取用户数据失败:', error);
      showToast('error', errorMessageFromUnknown(error, '获取用户数据失败'));
    }
    setLoading(false);
  }

  const parentCompanies = companies.filter((c) => !c.parent_id || c.parent_id === '0');
  const allBranchProjectIds = projects.map((p) => p.id);

  const userFormCompanyOptions = useMemo(
    () => [
    { value: '', label: '请选择公司' },
    ...companies.filter((c) => !c.parent_id || c.parent_id === '0').map((c) => ({ value: c.id, label: c.name }))],

    [companies]
  );
  const userFormRoleOptions = useMemo(
    () => [{ value: '', label: '请选择角色' }, ...roles.map((r) => ({ value: r.id, label: r.name }))],
    [roles]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const isEditing = !!editingId;

      if (isEditing) {
        const targetUser = users.find((u) => u.id === editingId);
        if (!targetUser || !canEditUser(targetUser)) {
          showToast('error', '您没有权限编辑此用户');
          return;
        }

        const updatePayload: any = {};
        if (formData.real_name !== undefined) updatePayload.real_name = formData.real_name || null;
        if (formData.phone !== undefined) updatePayload.phone = formData.phone || null;
        if (formData.email !== undefined) updatePayload.email = formData.email || null;
        if (formData.company_id !== undefined) updatePayload.company_id = formData.company_id || null;

        if (canModifyRoles()) {
          if (formData.role_id !== undefined) updatePayload.role_ids = formData.role_id ? [formData.role_id] : [];
          if (formData.project_ids !== undefined) updatePayload.project_ids = formData.project_ids;
          if (formData.status !== undefined) updatePayload.status = formData.status;
        }

        await updateUser(editingId, updatePayload);

        if (formData.password) {
          await resetPassword(editingId, formData.password);
        }

        showToast('success', '用户更新成功');
      } else {
        if (!canModifyRoles()) {
          showToast('error', '只有管理员可以创建用户');
          return;
        }

        if (!formData.password) {
          showToast('error', '请填写密码');
          return;
        }

        if (formData.password.length < 6) {
          showToast('error', '密码至少需要6个字符');
          return;
        }

        if (!formData.role_id) {
          showToast('error', '请选择角色');
          return;
        }

        await createUser({
          email: formData.email || undefined,
          password: formData.password,
          username: formData.username,
          real_name: formData.real_name,
          phone: formData.phone,
          company_id: formData.company_id || undefined,
          role_ids: formData.role_id ? [formData.role_id] : [],
          project_ids: formData.project_ids,
          status: formData.status
        });

        showToast('success', '用户创建成功');
      }

      setShowModal(false);
      setFormData({
        username: '',
        password: '',
        real_name: '',
        phone: '',
        email: '',
        company_id: '',
        role_id: '',
        project_ids: [],
        status: 'active'
      });
      setEditingId(null);
      fetchData();
    } catch (err: unknown) {
      console.error('新增用户失败:', err);
      showToast('error', errorMessageFromUnknown(err, '操作失败'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteId || !deletingUser) return;

    try {
      if (!canDeleteUser(deletingUser)) {
        showToast('error', '您没有权限删除此用户');
        return;
      }

      const relatedWarnings = await checkUserRelatedData(deleteId);

      if (relatedWarnings.length > 0) {
        setRelatedDataWarning(relatedWarnings);
        showToast('error', '该用户有关联数据，无法删除');
        return;
      }

      await deleteUserApi(deleteId);

      showToast('success', '用户删除成功');
      setShowDeleteModal(false);
      setDeleteId(null);
      setDeletingUser(null);
      setRelatedDataWarning([]);
      fetchData();
    } catch (err: unknown) {
      showToast('error', errorMessageFromUnknown(err, '删除失败'));
    }
  }

  async function handleToggleStatus(user: User) {
    if (!canModifyRoles()) {
      showToast('error', '您没有权限修改用户状态');
      return;
    }

    if (currentUser?.id === user.id) {
      showToast('error', '不能禁用自己的账号');
      return;
    }

    try {
      await updateUser(user.id, { status: user.status === 'active' ? 'disabled' : 'active' });
      showToast('success', user.status === 'active' ? '已禁用' : '已启用');
      fetchData();
    } catch (err: unknown) {
      showToast('error', errorMessageFromUnknown(err, '操作失败'));
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordUserId) return;

    const { newPassword, confirmPassword } = passwordForm;

    if (newPassword !== confirmPassword) {
      showToast('error', '两次输入的新密码不一致');
      return;
    }

    if (newPassword.length < 6) {
      showToast('error', '新密码至少需要6个字符');
      return;
    }

    try {
      await resetPassword(passwordUserId, newPassword);
      showToast('success', '密码重置成功，请使用新密码登录');
      setShowPasswordModal(false);
      setPasswordUserId(null);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      showToast('error', errorMessageFromUnknown(err, '密码重置失败'));
    }
  }

  const filteredUsers = users.filter((u) =>
  u.username.toLowerCase().includes(search.toLowerCase()) ||
  u.real_name && u.real_name.toLowerCase().includes(search.toLowerCase()) ||
  u.email && u.email.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getRoleNames = (roleIds: unknown) => {
    if (!Array.isArray(roleIds)) return '-';
    const ids = roleIds.filter((id): id is string => typeof id === 'string');
    return ids.map((id) => roles.find((r) => r.id === id)?.name).filter(Boolean).join(', ') || '-';
  };

  const getCompanyName = (companyId: unknown) => {
    const id = typeof companyId === 'string' ? companyId : null;
    if (!id) return '-';
    return companies.find((c) => c.id === id)?.name || '-';
  };

  const openEdit = (user: User) => {
    if (!canEditUser(user)) {
      showToast('error', '您没有权限编辑此用户');
      return;
    }

    setEditingId(user.id);
    setFormData({
      username: user.username,
      password: '',
      real_name: user.real_name || '',
      phone: user.phone || '',
      email: user.email || '',
      company_id: user.company_id || '',
      role_id: user.role_ids?.[0] || '',
      project_ids: user.project_ids || [],
      status: user.status as 'active' | 'disabled'
    });
    setShowModal(true);
  };

  const openDelete = async (user: User) => {
    if (!canDeleteUser(user)) {
      showToast('error', '您没有权限删除此用户');
      return;
    }

    setDeleteId(user.id);
    setDeletingUser(user);
    setRelatedDataWarning([]);

    const relatedWarnings = await checkUserRelatedData(user.id);
    setRelatedDataWarning(relatedWarnings);
    setShowDeleteModal(true);
  };

  const openPassword = (user: User) => {
    if (!canResetPassword(user)) {
      showToast('error', '您没有权限修改此用户的密码');
      return;
    }
    setPasswordUserId(user.id);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  if (authLoading) {
    return <div className="flex justify-center items-center h-64"><div className="text-gray-500">加载中...</div></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {toast && <SingleToastBanner type={toast.type} message={toast.message} />}

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-800">用户管理</h3>
        {canModifyRoles() &&
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({
              username: '',
              password: '',
              real_name: '',
              phone: '',
              email: '',
              company_id: '',
              role_id: '',
              project_ids: [],
              status: 'active'
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
          
            <FaPlus /> 新增用户
          </button>
        }
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="relative mb-4">
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="搜索用户名、姓名、邮箱..."
            value={search}
            onChange={(e) => {setSearch(e.target.value);setPage(1);}}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" />
          
        </div>

        {(() => {if (loading) {return (
              <div className="text-center text-gray-500 py-8">加载中...</div>);} else {if (
            paginatedUsers.length === 0) {return (
                <div className="text-center text-gray-500 py-8">暂无用户</div>);} else {return (

                <ResponsiveTable
                  columns={[
                  { key: 'real_name', label: '姓名', render: (val) => <span className="font-medium text-gray-800">{val == null || val === '' ? '-' : String(val)}</span> },
                  { key: 'username', label: '用户名', hiddenOnMobile: true },
                  { key: 'phone', label: '手机号', hiddenOnMobile: true },
                  { key: 'email', label: '邮箱', render: (val) => val ? <span className="text-blue-600">{String(val)}</span> : <span className="text-gray-400">未绑定</span> },
                  { key: 'wechat_work_userid', label: '企业微信', hiddenOnMobile: true, render: (_val, row) => {
                    const u = row as User;
                    return u.wechat_work_userid
                      ? <span className="text-green-700 text-xs">{u.wechat_work_name || u.wechat_work_userid}</span>
                      : <span className="text-gray-400 text-xs">未绑定</span>;
                  }},
                  { key: 'role_ids', label: '角色', render: (val) => getRoleNames(val), hiddenOnMobile: true },
                  { key: 'company_id', label: '所属公司', render: (val) => getCompanyName(val), hiddenOnMobile: true },
                  { key: 'project_ids', label: '项目权限', render: (val) => `${Array.isArray(val) ? val.length : 0} 个项目`, hiddenOnMobile: true },
                  { key: 'status', label: '状态', render: (val, row) =>
                    <span className={`px-2 py-1 rounded text-xs ${val === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {val === 'active' ? '启用' : '禁用'}
                </span>
                  },
                  { key: 'last_login_at', label: '最后登录', render: (val) => typeof val === 'string' && val ? new Date(val).toLocaleString('zh-CN') : '-', hiddenOnMobile: true }]
                  }
                  data={paginatedUsers}
                  keyField="id"
                  actionColumn={(u) =>
                  <div className="flex items-center justify-center gap-1">
                <button
                      onClick={() => openEdit(u)}
                      className={`p-2.5 rounded-lg ${canEditUser(u) ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-300 cursor-not-allowed'}`}
                      title="编辑"
                      disabled={!canEditUser(u)}>
                      
                  <FaEdit className="w-4 h-4" />
                </button>
                <button
                      onClick={() => openPassword(u)}
                      className={`p-2.5 rounded-lg ${canResetPassword(u) ? 'text-purple-600 hover:bg-purple-50' : 'text-gray-300 cursor-not-allowed'}`}
                      title="重置密码"
                      disabled={!canResetPassword(u)}>
                      
                  <FaKey className="w-4 h-4" />
                </button>
                {u.status === 'active' && canModifyRoles() && currentUser?.id !== u.id &&
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className="p-2.5 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                      title="禁用">
                      
                    <FaBan className="w-4 h-4" />
                  </button>
                    }
                {u.status === 'disabled' && canModifyRoles() && currentUser?.id !== u.id &&
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className="p-2.5 text-green-600 hover:bg-green-50 rounded-lg"
                      title="启用">
                      
                    <FaCheck className="w-4 h-4" />
                  </button>
                    }
                {canDeleteUser(u) &&
                    <button
                      onClick={() => openDelete(u)}
                      className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg"
                      title="删除">
                      
                    <FaTrash className="w-4 h-4" />
                  </button>
                    }
              </div>
                  } />);}}})()

        }

        {totalPages > 1 &&
        <div className="flex justify-center items-center gap-2 mt-4">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50">上一页</button>
            <span className="text-gray-500">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50">下一页</button>
          </div>
        }
      </div>

      <AnimatePresence>
        {showModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">{editingId ? '编辑用户' : '新增用户'}</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">用户名 <span className="text-red-500">*</span></label>
                    <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    disabled={!!editingId}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 disabled:opacity-50" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">姓名 <span className="text-gray-400 text-xs">（企微扫码可匹配）</span></label>
                    <input
                    type="text"
                    value={formData.real_name}
                    onChange={(e) => setFormData({ ...formData, real_name: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" />
                  
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">手机号 <span className="text-gray-400 text-xs">（登录/企微匹配）</span></label>
                    <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" />
                  
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-2">内部邮箱 <span className="text-gray-400 text-xs">（可选，不用于登录）</span></label>
                    <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" />
                  
                  </div>
                </div>

                {editingId && (() => {
                  const editUser = users.find((u) => u.id === editingId);
                  if (!editUser) return null;
                  return (
                    <WechatWorkBindPanel
                      user={editUser}
                      canManage={canModifyRoles()}
                      showToast={showToast}
                      onUpdated={() => void fetchData()}
                    />
                  );
                })()}

                <div>
                  <label className="block text-sm text-gray-600 mb-2">
                    {editingId ? '新密码（留空则保持原密码）' : '密码'}
                    {!editingId && <span className="text-red-500">*</span>}
                  </label>
                  <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800"
                  placeholder={editingId ? '留空则保持原密码' : '至少6个字符'} />
                
                  {!editingId && <p className="text-xs text-gray-500 mt-1">密码至少需要6个字符</p>}
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2"><FaBuilding className="inline mr-1" />所属公司</label>
                  <SearchableSelect
                  value={formData.company_id}
                  onChange={(cid) => {
                    const selectedCompany = parentCompanies.find((c) => c.id === cid);
                    setFormData({
                      ...formData,
                      company_id: cid,
                      project_ids: selectedCompany ? allBranchProjectIds : []
                    });
                  }}
                  options={userFormCompanyOptions}
                  placeholder="请选择公司"
                  emptyLabel="请选择公司"
                  searchPlaceholder="搜索公司…"
                  metricsContext="page:user_management:form_company" />
                
                </div>

                {canModifyRoles() &&
              <>
                <div>
                  <label className="block text-sm text-gray-600 mb-2"><FaUserShield className="inline mr-1" />角色 <span className="text-red-500">*</span></label>
                  <SearchableSelect
                    value={formData.role_id}
                    onChange={(roleId) => {
                      const selectedRole = roles.find((r) => r.id === roleId);
                      setFormData({
                        ...formData,
                        role_id: roleId,
                        project_ids: selectedRole?.code === 'project_manager' ? formData.project_ids : []
                      });
                    }}
                    options={userFormRoleOptions}
                    placeholder="请选择角色"
                    emptyLabel="请选择角色"
                    searchPlaceholder="搜索角色…"
                    metricsContext="page:user_management:form_role" />
                  
                </div>

                {roles.find((r) => r.id === formData.role_id)?.code === 'project_manager' &&
                <div>
                    <label className="block text-sm text-gray-600 mb-2"><FaProjectDiagram className="inline mr-1" />项目权限（多选）</label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                      {projects.map((p) =>
                    <label key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer ${formData.project_ids.includes(p.id) ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 text-gray-700'}`}>
                          <input
                        type="checkbox"
                        checked={formData.project_ids.includes(p.id)}
                        onChange={(e) => {
                          const ids = e.target.checked ? [...formData.project_ids, p.id] : formData.project_ids.filter((id) => id !== p.id);
                          setFormData({ ...formData, project_ids: ids });
                        }}
                        className="hidden" />
                      
                          {p.name}
                        </label>
                    )}
                    </div>
                  </div>
                }

                    <div>
                      <label className="block text-sm text-gray-600 mb-2">状态</label>
                      <SegmentedControl
                    value={formData.status}
                    onChange={(v) => setFormData({ ...formData, status: v as 'active' | 'disabled' })}
                    options={[
                    { value: 'active', label: '启用' },
                    { value: 'disabled', label: '禁用' }]
                    }
                    metricsContext="page:user_management:form_status"
                    aria-label="用户状态" />
                  
                    </div>
                  </>
              }

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {(() => {if (submitting) {return '提交中...';} else {if (editingId) {return '保存';} else {return '新增';}}})()}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteModal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <FaExclamationTriangle className="text-red-500 text-2xl" />
                <h3 className="text-xl font-bold text-gray-800">确认删除</h3>
              </div>

              {relatedDataWarning.length > 0 ?
            <div className="mb-4">
                  <p className="text-red-600 font-medium mb-3">无法删除，请先转移或删除关联数据</p>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {relatedDataWarning.map((warning, index) =>
                <li key={index}>{warning}</li>
                )}
                  </ul>
                </div> :

            <p className="text-gray-700 mb-6">确定要删除用户 <strong>{deletingUser?.username}</strong> 吗？此操作不可恢复。</p>
            }

              <div className="flex justify-end gap-3">
                <button onClick={() => {setShowDeleteModal(false);setDeleteId(null);setDeletingUser(null);setRelatedDataWarning([]);}} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
                {relatedDataWarning.length === 0 &&
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">删除</button>
              }
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      <AnimatePresence>
        {showPasswordModal &&
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPasswordModal(false)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">重置密码</h3>
                <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">新密码 <span className="text-red-500">*</span></label>
                  <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800"
                  placeholder="至少6个字符" />
                
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-2">确认新密码 <span className="text-red-500">*</span></label>
                  <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-800" />
                
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">取消</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">确认重置</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </motion.div>);

}