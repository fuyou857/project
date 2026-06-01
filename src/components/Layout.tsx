import { useState, useEffect, Fragment, useMemo, memo } from 'react';
import SubmitApprovalProvider from './approval/SubmitApprovalProvider';
import WechatWorkOAuthHandler from './admin/WechatWorkOAuthHandler';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronDown, FaChevronLeft, FaAngleRight, FaSignOutAlt, FaBars, FaTimes, FaUser, FaBell } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import { useFilteredMenuItems } from '../hooks/useMenuAccess';
import { useMergedRolePermissions } from '../hooks/useMergedRolePermissions';
import { resolveMenuParentPath } from '../config/menuAccess';
import type { NavMenuItem } from '../types/navMenu';
import { NAV_MENU_ITEMS } from '../config/navMenuDefinition';
import RoutePermissionGuard from './RoutePermissionGuard';
import { useApp, Company } from '../stores';
import { countUnreadNotifications } from '../services/notificationService';
import { useApprovalPendingCount } from '../hooks/useApprovalPendingCount';
import { UiPreferencesProvider, useUiPreferences } from '../contexts/UiPreferencesContext';
import { ToastProvider, useToast } from '../contexts/ToastContext';

export const useCompany = useApp;

export { NAV_MENU_ITEMS };

const MenuIcon = memo(function MenuIcon({ icon, className }: { icon: NavMenuItem['icon']; className?: string }) {
  const I = icon;
  if (typeof I !== 'function') return <span className={className} aria-hidden />;
  return <I className={className} />;
});

function CompanySelector() {
  const { currentCompany, companies, setCurrentCompany } = useApp();
  const [open, setOpen] = useState(false);

  const getParentCompanies = (cList: typeof companies) =>
    cList.filter(c => c.company_type === '总公司' || c.parent_id === '0');

  const parentCompanies = getParentCompanies(companies);

  const handleSelect = (c: Company) => {
    setCurrentCompany(c);
    setOpen(false);
  };

  if (!currentCompany) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-700 rounded-lg hover:bg-blue-600 transition-colors"
      >
        <span className="max-w-48 truncate">{currentCompany.name}</span>
        <FaChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50"
        >
          <div className="max-h-80 overflow-y-auto py-2">
            {parentCompanies.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${currentCompany.id === c.id ? 'bg-blue-100 text-blue-800' : 'text-gray-700'}`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function TopNav({
  menuItems,
  onMobileMenuClick,
}: {
  menuItems: NavMenuItem[];
  onMobileMenuClick?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const pathname = location.pathname;
  const isActive = (path: string) => pathname.startsWith(path);
  const { tableDensity, setTableDensity } = useUiPreferences();

  const getFirstChildPath = (item: NavMenuItem): string => {
    if (!item.children || item.children.length === 0) return item.path;
    return getFirstChildPath(item.children[0]);
  };

  const handleNavClick = (item: NavMenuItem) => {
    navigate(getFirstChildPath(item));
    setShowMobileNav(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setShowUserMenu(false);
    setShowMobileNav(false);
    navigate('/login');
  };

  const getUserName = () => {
    if (!user) return '未知用户';
    return user.real_name || user.username || user.email?.split('@')[0] || '未知用户';
  };

  const userId = user?.id;
  useEffect(() => {
    if (!userId) {
      setUnreadMessages(0);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const n = await countUnreadNotifications(userId);
        if (!cancelled) setUnreadMessages(n);
      } catch {
        if (!cancelled) setUnreadMessages(0);
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [userId]);

  return (
    <>
      <nav className="bg-blue-800 border-b border-blue-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setShowMobileNav(!showMobileNav);
                onMobileMenuClick?.();
              }}
              className="md:hidden p-2 text-white hover:bg-blue-700 rounded-lg transition-colors min-w-[44px] h-[44px] flex items-center justify-center"
            >
              {showMobileNav ? <FaTimes className="w-6 h-6" /> : <FaBars className="w-6 h-6" />}
            </button>
            <div className="text-title font-bold text-white">
              建筑工程管理系统
            </div>
            <div className="hidden md:flex items-center gap-1">
              {menuItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center ${isActive(item.path) ? 'bg-blue-600 text-white' : 'text-blue-100 hover:bg-blue-700'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/messages"
              className="relative flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-white hover:bg-blue-700 transition-colors"
              title="消息中心"
              aria-label="消息中心"
            >
              <FaBell className="w-5 h-5" />
              {unreadMessages > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-0.5 text-[10px] font-bold leading-[18px] text-center bg-red-500 text-white rounded-full">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </Link>
            <CompanySelector />
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white bg-blue-700 rounded-lg hover:bg-blue-600 transition-colors min-h-[44px]"
              >
                <FaUser className="w-4 h-4" />
                <span className="max-w-24 truncate">{getUserName()}</span>
                <FaChevronDown className="w-4 h-4" />
              </button>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-50"
                >
                  <div className="border-b border-gray-100 px-3 py-2">
                    <div className="text-caption font-medium text-gray-500">表格行高</div>
                    <div className="mt-1 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setTableDensity('comfortable')}
                        className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                          tableDensity === 'comfortable'
                            ? 'bg-blue-100 text-blue-800'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        标准
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableDensity('compact')}
                        className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                          tableDensity === 'compact'
                            ? 'bg-blue-100 text-blue-800'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        紧凑
                      </button>
                    </div>
                  </div>
                  <div className="py-2">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <FaSignOutAlt className="w-4 h-4" />
                      退出登录
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {showMobileNav && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-blue-700 border-b border-blue-600"
          >
            <div className="p-2 space-y-1">
              {menuItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-white text-sm font-medium transition-colors ${isActive(item.path) ? 'bg-blue-600' : 'hover:bg-blue-600'}`}
                >
                  <MenuIcon icon={item.icon} className="w-5 h-5" />
                  {item.label}
                  {item.children && <FaAngleRight className="w-4 h-4 ml-auto" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Sidebar({
  menuItems,
  mobileMenuOpen,
  onClose,
  approvalPendingCount = 0,
}: {
  menuItems: NavMenuItem[];
  mobileMenuOpen: boolean;
  onClose?: () => void;
  approvalPendingCount?: number;
}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const pathname = location.pathname;
  const isActive = (path: string) => {
    if (path === '/contract/templates') {
      if (pathname === '/contract/templates/my-generated' || pathname === '/contract/templates/my-generated/trash')
        return false;
      return pathname === '/contract/templates' || pathname.startsWith('/contract/templates/edit/');
    }
    return pathname === path || pathname.startsWith(path + '/');
  };

  const parentPath = resolveMenuParentPath(pathname);

  /** 合同侧栏四个二级模块默认展开：收入合同、支出合同、合同模板管理、其他 */
  useEffect(() => {
    if (parentPath === '/contract') {
      setExpandedGroups(['收入合同', '支出合同', '合同模板管理', '其他']);
    }
  }, [parentPath]);
  const currentParent = parentPath
    ? menuItems.find(m => m.path === parentPath) ?? null
    : null;
  const currentChildren = currentParent?.children || [];

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const renderChildItem = (item: NavMenuItem, index: number, opts?: { indentClass?: string }) => {
    const active = isActive(item.path);
    const indent = opts?.indentClass?.trim() ? `${opts.indentClass} ` : '';

    const handleClick = () => {
      onClose?.();
    };

    return (
      <Link
        key={item.path + index}
        to={item.path}
        onClick={handleClick}
        className={`${indent}w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors min-h-[44px] ${active ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-gray-50'}`}
      >
        <MenuIcon icon={item.icon} className="w-5 h-5" />
        <span className="flex-1">{item.label}</span>
        {item.path === '/approval' && approvalPendingCount > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 text-[10px] font-bold leading-5 text-center bg-red-500 text-white rounded-full">
            {approvalPendingCount > 99 ? '99+' : approvalPendingCount}
          </span>
        )}
      </Link>
    );
  };

  /** 合同管理侧栏：收入合同 → 支出合同 → 合同模板管理 → 其他（固定顺序） */
  const CONTRACT_SIDEBAR_GROUP_ORDER = ['收入合同', '支出合同', '合同模板管理', '其他'] as const;

  const groupedContractChildren = (): { [key: string]: NavMenuItem[] } => {
    const groups: { [key: string]: NavMenuItem[] } = {};
    currentChildren.forEach(child => {
      const p = child.path;
      if (p.includes('/contract/income/')) {
        (groups['收入合同'] = groups['收入合同'] || []).push(child);
      } else if (p.includes('/contract/expense/')) {
        (groups['支出合同'] = groups['支出合同'] || []).push(child);
      } else if (p === '/contract/templates' || p.startsWith('/contract/templates/')) {
        (groups['合同模板管理'] = groups['合同模板管理'] || []).push(child);
      } else {
        (groups['其他'] = groups['其他'] || []).push(child);
      }
    });
    return groups;
  };

  if (!currentParent || currentChildren.length === 0) {
    return null;
  }

  const isContractSidebar = currentParent.path === '/contract';
  const groups = isContractSidebar ? groupedContractChildren() : { 子菜单: currentChildren };

  const renderSidebarGroups = (variant: 'desktop' | 'mobile') => {
    if (!isContractSidebar) {
      const flat = groups['子菜单'] ?? [];
      return (
        <div key="flat" className="space-y-1 px-2">
          {flat.map((item, index) => renderChildItem(item, index))}
        </div>
      );
    }

    return (
      <>
        {CONTRACT_SIDEBAR_GROUP_ORDER.map(groupName => {
          const items = groups[groupName];
          if (!items?.length) return <Fragment key={groupName} />;

          if (groupName === '其他' && items.length === currentChildren.length) {
            return (
              <div key={groupName} className="space-y-1 px-2">
                {items.map((item, index) => renderChildItem(item, index))}
              </div>
            );
          }

          const expanded = expandedGroups.includes(groupName);
          const isDesktop = variant === 'desktop';

          return (
            <div key={groupName}>
              <button
                type="button"
                onClick={() => toggleGroup(groupName)}
                className={`w-full flex items-center justify-between px-4 ${isDesktop ? 'py-2' : 'py-3'} text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px]`}
              >
                <span>{!isDesktop || !collapsed ? groupName : ''}</span>
                {(isDesktop ? !collapsed : true) && (
                  <FaChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                )}
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 pl-4 border-l border-gray-200 mt-1 space-y-1">
                      {items.map((item, index) => {
                        if (item.path === '/contract/templates' && item.children?.length) {
                          return (
                            <div key={item.path} className="space-y-1">
                              {item.children.map((sub, j) =>
                                renderChildItem(sub, j, { indentClass: 'pl-1' }),
                              )}
                            </div>
                          );
                        }
                        return renderChildItem(item, index);
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <>
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${collapsed ? 'w-16' : 'w-[220px]'}`}>
        <div className="flex-1 overflow-y-auto py-4">
          {renderSidebarGroups('desktop')}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors min-h-[44px]"
        >
          {collapsed ? <FaChevronLeft className="w-4 h-4" /> : <FaChevronDown className="w-4 h-4 rotate-180" />}
        </button>
      </aside>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '-100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '-100%' }}
            className="md:hidden fixed inset-y-0 left-0 top-20 w-72 bg-white shadow-xl z-40 overflow-y-auto"
          >
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={(e) => { e.stopPropagation(); onClose?.(); }}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg min-h-[44px] flex items-center"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4">{renderSidebarGroups('mobile')}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function WechatWorkOAuthHost({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  return (
    <>
      {children}
      <WechatWorkOAuthHandler showToast={showToast} />
    </>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { mergedPerms, loading: permsLoading } = useMergedRolePermissions();
  const visibleMenu = useFilteredMenuItems(NAV_MENU_ITEMS, mergedPerms, permsLoading);
  const approvalPendingCount = useApprovalPendingCount();

  /** 顶部主导航不展示已废弃的独立「合同模板」顶层项，亦不展示仅标记 hideFromTopNav 的占位（当前无顶层占位） */
  const topNavMenuItems = useMemo(
    () => visibleMenu.filter(m => m.path !== '/contract-templates' && m.hideFromTopNav !== true),
    [visibleMenu],
  );

  const handleCloseMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <UiPreferencesProvider>
      <ToastProvider>
      <SubmitApprovalProvider>
      <WechatWorkOAuthHost>
      <div className="flex h-screen flex-col bg-surface-page">
        <TopNav
          menuItems={topNavMenuItems}
          onMobileMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            menuItems={visibleMenu}
            mobileMenuOpen={mobileMenuOpen}
            onClose={handleCloseMobileMenu}
            approvalPendingCount={approvalPendingCount}
          />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <main className="flex flex-1 flex-col overflow-auto bg-surface-page">
              <div className="ui-main-inner flex min-h-0 flex-1 flex-col">
                <RoutePermissionGuard mergedPerms={mergedPerms} loading={permsLoading}>
                  {children}
                </RoutePermissionGuard>
              </div>
            </main>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={(e) => { e.stopPropagation(); handleCloseMobileMenu(); }}
              className="fixed inset-0 z-30 bg-black/50 md:hidden"
            />
          )}
        </AnimatePresence>
      </div>
      </WechatWorkOAuthHost>
      </SubmitApprovalProvider>
      </ToastProvider>
    </UiPreferencesProvider>
  );
}