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
