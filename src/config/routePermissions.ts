/**
 * 将 URL 映射为访问所需的权限键（满足任一即可）。
 * 与侧栏菜单同源数据（navMenuDefinition）+ 少量路由特例。
 */
import { NAV_MENU_ITEMS, permissionKey } from './navMenuDefinition';
import type { NavMenuItem } from '../types/navMenu';
import { TOP_PATH_REQUIRES_ANY_PERM } from './menuAccess';

export function normalizePathname(pathname: string): string {
  const raw = pathname.split('?')[0] || '/';
  if (raw === '') return '/';
  if (raw !== '/' && raw.endsWith('/')) return raw.slice(0, -1);
  return raw;
}

type RegexRule = { kind: 'regex'; regex: RegExp; keys: string[] };
type PrefixRule = { kind: 'prefix'; path: string; keys: string[]; exact: boolean };

function collectRouteLeavesFromNav(items: NavMenuItem[]): NavMenuItem[] {
  return items.flatMap(it => (it.children?.length ? collectRouteLeavesFromNav(it.children) : [it]));
}

function buildPrefixRulesFromNav(): PrefixRule[] {
  const rules: PrefixRule[] = [];
  for (const top of NAV_MENU_ITEMS) {
    const leaves = top.children?.length ? collectRouteLeavesFromNav(top.children) : [top];
    for (const leaf of leaves) {
      const p = leaf.path;
      if (p.startsWith('/projects')) continue;
      rules.push({
        kind: 'prefix',
        path: p,
        keys: [permissionKey(leaf)],
        exact: false,
      });
    }
  }
  return rules;
}

/** 长路径优先，避免 /finance 吞掉 /finance/invoice-list */
function sortPrefixRules(rules: PrefixRule[]): PrefixRule[] {
  return [...rules].sort((a, b) => {
    if (b.path.length !== a.path.length) return b.path.length - a.path.length;
    return a.path.localeCompare(b.path);
  });
}

const REGEX_RULES: RegexRule[] = [
  { kind: 'regex', regex: /^\/projects\/new(\/|$)/, keys: ['新建项目'] },
  {
    kind: 'regex',
    regex: /^\/projects\/(?!new(?:\/|$))[^/]+(\/.*)?$/,
    keys: ['项目详情'],
  },
  { kind: 'regex', regex: /^\/projects\/?$/, keys: ['项目列表'] },
  { kind: 'regex', regex: /^\/project\/supplier\//, keys: ['项目列表', '项目详情'] },
  {
    kind: 'regex',
    regex: /^\/tasks\/(?!published|todo|involved|stats)[^/]+$/,
    keys: ['我发布的任务', '我的待办任务'],
  },
];

const PREFIX_RULES_SORTED: PrefixRule[] = sortPrefixRules([
  ...buildPrefixRulesFromNav(),
  {
    kind: 'prefix',
    path: '/tasks',
    keys: TOP_PATH_REQUIRES_ANY_PERM['/tasks'] ?? ['我发布的任务', '我的待办任务'],
    exact: true,
  },
  { kind: 'prefix', path: '/finance/invoice-issue', keys: ['收入发票开具'], exact: true },
  { kind: 'prefix', path: '/workers/contract', keys: ['农民工档案'], exact: true },
  { kind: 'prefix', path: '/seals/apply', keys: ['用章申请'], exact: true },
  { kind: 'prefix', path: '/contract', keys: ['收入合同签约管理'], exact: true },
  { kind: 'prefix', path: '/finance', keys: ['收入发票开具'], exact: true },
  { kind: 'prefix', path: '/materials', keys: ['物资清单'], exact: true },
  { kind: 'prefix', path: '/labor', keys: ['产值上报'], exact: true },
  { kind: 'prefix', path: '/machines', keys: ['机械台账'], exact: true },
  { kind: 'prefix', path: '/admin', keys: TOP_PATH_REQUIRES_ANY_PERM['/admin'] ?? [], exact: true },
  {
    kind: 'prefix',
    path: '/base-data',
    keys: TOP_PATH_REQUIRES_ANY_PERM['/base-data'] ?? [],
    exact: true,
  },
]);

/**
 * @returns 所需权限键（满足其一即可）；无匹配规则时返回 null（由守卫自行决定是否放行）
 */
export function getRequiredPermissionKeysForPath(pathname: string): string[] | null {
  const p = normalizePathname(pathname);

  /**
   * 基础数据下所有子路由与顶层模块一致：具备任一基础数据子权限即可访问。
   * 否则 buildPrefixRulesFromNav 会为 /base-data/project-mgmt-staff 单独要求「项目部管理人员」，
   * 历史角色仅有甲方/签约/乙方键时会打不开页面，侧栏若与其它逻辑不同步也会表现为「没有第四项」。
   */
  if (p === '/base-data' || p.startsWith('/base-data/')) {
    const keys = TOP_PATH_REQUIRES_ANY_PERM['/base-data'] ?? [];
    return keys.length > 0 ? keys : null;
  }

  /** 任务管理下所有子路由：具备「我发布的任务」或「我的待办任务」任一即可（与菜单始终展示一致，避免新菜单键未勾选角色时整模块消失） */
  if (p === '/tasks' || p.startsWith('/tasks/')) {
    const keys = TOP_PATH_REQUIRES_ANY_PERM['/tasks'] ?? [];
    return keys.length > 0 ? keys : null;
  }

  /** 旧独立模块 URL：重定向前仍须能匹配权限（键仍为「合同模板库」） */
  if (p === '/contract-templates' || p.startsWith('/contract-templates/')) {
    return ['合同模板库'];
  }

  /** 并入合同管理后：与菜单/expand 一致，具备任一合同子权限即可进入（避免仅有收入/支出键却打不开模板页） */
  if (p === '/contract/templates' || p.startsWith('/contract/templates/')) {
    const keys = TOP_PATH_REQUIRES_ANY_PERM['/contract'] ?? [];
    return keys.length > 0 ? keys : ['合同模板库'];
  }

  for (const r of REGEX_RULES) {
    if (r.regex.test(p)) return r.keys;
  }

  for (const r of PREFIX_RULES_SORTED) {
    if (r.exact) {
      if (p === r.path) return r.keys;
      continue;
    }
    if (p === r.path || p.startsWith(r.path + '/')) return r.keys;
  }

  return null;
}

/** 仅 super_admin 角色码可访问（不含 admin 别名） */
export const STRICT_SUPER_ADMIN_PATH_PREFIXES = ['/admin/keys'];

export function canAccessPathWithPermissions(
  pathname: string,
  isSuperAdmin: boolean,
  mergedPerms: Set<string>,
  isStrictSuperAdmin = false,
): boolean {
  const p = normalizePathname(pathname);
  if (
    STRICT_SUPER_ADMIN_PATH_PREFIXES.some(
      prefix => p === prefix || p.startsWith(`${prefix}/`),
    )
  ) {
    return isStrictSuperAdmin;
  }
  if (isSuperAdmin) return true;
  const required = getRequiredPermissionKeysForPath(pathname);
  if (required === null) return false;
  if (required.length === 0) return false;
  return required.some(k => mergedPerms.has(k));
}
