/**
 * 侧栏/权限用的纯函数（无 UI 依赖），供菜单定义与单元测试共用。
 */
export interface NavMenuItemLike {
  path: string;
  label: string;
  permKey?: string;
  children?: NavMenuItemLike[];
}

export function permissionKey(item: { permKey?: string; label: string }): string {
  return (item.permKey ?? item.label).trim();
}

/** 收集菜单项及其所有后代叶子上的权限键（用于顶层模块「任一子权限」） */
export function permissionKeysDescendants(item: NavMenuItemLike): string[] {
  if (!item.children?.length) return [permissionKey(item)];
  return item.children.flatMap(permissionKeysDescendants);
}

/** 侧栏归属：任意子菜单 path（含嵌套）→ 所属顶层 path */
export function buildNavChildToParentPathMap(items: NavMenuItemLike[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { childPath, parentPath } of buildNavChildToParentPathEntries(items)) {
    map.set(childPath, parentPath);
  }
  return map;
}

/** 子菜单 path 列表（越长越优先），用于详情页等未在菜单中声明的子路由归属 */
export function buildNavChildToParentPathEntries(
  items: NavMenuItemLike[],
): { childPath: string; parentPath: string }[] {
  const entries: { childPath: string; parentPath: string }[] = [];
  for (const top of items) {
    entries.push({ childPath: top.path, parentPath: top.path });
    const walk = (children: NavMenuItemLike[]) => {
      for (const ch of children) {
        entries.push({ childPath: ch.path, parentPath: top.path });
        if (ch.children?.length) walk(ch.children);
      }
    };
    if (top.children?.length) walk(top.children);
  }
  return entries.sort((a, b) => {
    if (b.childPath.length !== a.childPath.length) return b.childPath.length - a.childPath.length;
    return a.childPath.localeCompare(b.childPath);
  });
}

/** 顶层 path → 显示该模块所需的权限键（满足任一即可） */
export function buildTopPathRequiresAnyPermFromNav(
  items: NavMenuItemLike[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const top of items) {
    const keys = top.children?.length
      ? [...new Set(top.children.flatMap(permissionKeysDescendants))]
      : [permissionKey(top)];
    map[top.path] = keys;
  }
  return map;
}
