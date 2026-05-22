/**
 * 菜单可见性与 roles.permissions 中的权限键对应。
 * 顶层模块所需键来自 navMenuDefinition（与侧栏同源）。
 * 注意：须使用 buildTopPathRequiresAnyPermFromNav(NAV_MENU_ITEMS)，勿从 navMenuDefinition 再包一层函数，
 * 否则部分生产打包下该导出可能被解析为 undefined，模块初始化即抛错导致整站白屏。
 */
import { NAV_MENU_ITEMS } from './navMenuDefinition';
import { buildTopPathRequiresAnyPermFromNav } from './navPermissionHelpers';

export const TOP_PATH_REQUIRES_ANY_PERM = buildTopPathRequiresAnyPermFromNav(NAV_MENU_ITEMS);

/** 顶层菜单 path 列表（越长越优先匹配；同长度再按字典序，避免排序不稳定） */
export function topMenuPrefixesSorted(): string[] {
  return Object.keys(TOP_PATH_REQUIRES_ANY_PERM).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a.localeCompare(b);
  });
}

/** 当前路径应归属哪个顶层菜单（用于侧栏），pathname 为 HashRouter 下的路径 */
export function resolveMenuParentPath(pathname: string): string | null {
  if (pathname.startsWith('/project/supplier')) {
    return '/projects';
  }
  const p = pathname.split('?')[0] || '/';
  if (p === '/messages' || p.startsWith('/messages/') || p === '/approval' || p.startsWith('/approval/')) {
    return '/tasks';
  }
  for (const prefix of topMenuPrefixesSorted()) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return prefix;
    }
  }
  return null;
}

/**
 * 历史上「分配权限」里使用过的文案 → 当前权限键（登录合并角色权限时双向兼容）
 */
export const LEGACY_PERMISSION_SYNONYMS: Record<string, string> = {
  角色权限: '角色管理',
  印章管理: '用章申请',
  临时用印: '印章外借情况',
  用印记录: '历史记录',
  人员管理: '农民工档案',
  考勤管理: '考勤记录',
  工资支付: '工资台账',
  考勤审核: '产值审核',
  劳务台账: '产值上报',
  /** 侧栏展示「合同模板管理」与角色里存储键「合同模板库」双向兼容 */
  合同模板管理: '合同模板库',
};

/** 将数据库中的权限字符串扩展为有效键集合（含新旧别名） */
export function expandPermissionKeys(raw: Iterable<string>): Set<string> {
  const s = new Set<string>();
  for (const p of raw) {
    if (typeof p !== 'string' || !p.trim()) continue;
    const t = p.trim();
    s.add(t);
    const mapped = LEGACY_PERMISSION_SYNONYMS[t];
    if (mapped) s.add(mapped);
  }
  for (const [legacy, canon] of Object.entries(LEGACY_PERMISSION_SYNONYMS)) {
    if (s.has(canon)) s.add(legacy);
  }
  /** 具备任一「基础数据」子权限则视为拥有该模块下全部菜单键（与路由守卫、侧栏一致，兼容旧角色数据） */
  const baseDataKeys = TOP_PATH_REQUIRES_ANY_PERM['/base-data'];
  if (baseDataKeys?.length && baseDataKeys.some(k => s.has(k))) {
    for (const k of baseDataKeys) {
      s.add(k);
    }
  }
  /** 具备任一「任务管理」子权限则同时开放消息中心、任务统计（与菜单扩展项一致） */
  const taskModuleKeys = TOP_PATH_REQUIRES_ANY_PERM['/tasks'];
  if (taskModuleKeys?.length && taskModuleKeys.some(k => s.has(k))) {
    s.add('消息中心');
    s.add('任务统计');
    s.add('审批中心');
  }
  /** 具备任一系统管理类权限时，补充任务管理键（新模块未写入历史角色 permissions 时仍可访问） */
  const taskKeys = TOP_PATH_REQUIRES_ANY_PERM['/tasks'];
  const implicitTaskIfHas = ['角色管理', '用户管理', '公司管理', '操作日志', '备份设置'];
  if (taskKeys?.length && implicitTaskIfHas.some(k => s.has(k))) {
    for (const k of taskKeys) {
      s.add(k);
    }
    s.add('消息中心');
    s.add('任务统计');
  }
  /**
   * 具备任一「合同管理」子权限（不含单独勾选「合同模板库」）时，同步开放「合同模板库」键，
   * 与收入/支出合同工作流衔接；权限键仍存为「合同模板库」，角色分配与 RLS 语义不变。
   */
  const contractModuleKeys = TOP_PATH_REQUIRES_ANY_PERM['/contract'] ?? [];
  const templateLibKey = '合同模板库';
  if (contractModuleKeys.some(k => s.has(k) && k !== templateLibKey)) {
    s.add(templateLibKey);
  }
  return s;
}

/** 保存角色或打开编辑框时：合并旧文案为新权限键，去重 */
export function canonicalizePermissions(perms: string[]): string[] {
  const out = new Set<string>();
  for (const p of perms) {
    if (typeof p !== 'string' || !p.trim()) continue;
    const t = p.trim();
    out.add(LEGACY_PERMISSION_SYNONYMS[t] ?? t);
  }
  return [...out];
}

export function canShowTopMenuPath(
  menuPath: string,
  isSuperAdmin: boolean,
  mergedPerms: Set<string>
): boolean {
  if (isSuperAdmin) return true;
  // 基础数据模块：始终允许访问（细粒度权限控制在页面级别）
  if (menuPath === '/base-data') return true;
  // 任务管理：与基础数据一致，顶层始终显示；子页由路由守卫要求「任一类任务权限」
  if (menuPath === '/tasks') return true;
  if (mergedPerms.size === 0) return false;
  const required = TOP_PATH_REQUIRES_ANY_PERM[menuPath];
  if (!required?.length) return true;
  return required.some(p => mergedPerms.has(p));
}

/** 是否显示某个子菜单项（permissionKey 与 roles.permissions 中存储一致） */
export function canShowChildMenuItem(
  permissionKey: string,
  isSuperAdmin: boolean,
  mergedPerms: Set<string>
): boolean {
  if (isSuperAdmin) return true;
  if (mergedPerms.size === 0) return false;
  return mergedPerms.has(permissionKey);
}
