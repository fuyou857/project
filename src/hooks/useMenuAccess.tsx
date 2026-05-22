import { useMemo } from 'react';
import { useAuth } from './useAuth';
import type { NavMenuItem } from '../types/navMenu';
import { permissionKey, CONTRACT_TEMPLATE_MENU_WRAPPER } from '../config/navMenuDefinition';
import { canShowTopMenuPath, canShowChildMenuItem, TOP_PATH_REQUIRES_ANY_PERM } from '../config/menuAccess';

/** 与 expandPermissionKeys 一致：具备任一其他合同子权限时，应显示「合同模板管理」菜单项 */
function implicitContractTemplateMenuAccess(mergedPerms: Set<string>): boolean {
  const keys = TOP_PATH_REQUIRES_ANY_PERM['/contract'] ?? [];
  const templateLibKey = '合同模板库';
  return keys.some(k => k !== templateLibKey && mergedPerms.has(k));
}

/** 合同子菜单：保留「仅作分组父级、不单独展示」但含可见子项的节点（如合同模板分组） */
function sidebarVisibleContractChildren(children: NavMenuItem[] | undefined): NavMenuItem[] {
  return (
    children?.filter(ch => {
      if (ch.showInSidebar === false && ch.children?.length) {
        return ch.children.some(s => s.showInSidebar !== false);
      }
      return ch.showInSidebar !== false;
    }) ?? []
  );
}

function filterContractChildren(
  visibleChildren: NavMenuItem[],
  isSuperAdmin: boolean,
  mergedPerms: Set<string>,
): NavMenuItem[] {
  const out: NavMenuItem[] = [];
  for (const ch of visibleChildren) {
    if (ch.children?.length) {
      const inner = ch.children.filter(s => s.showInSidebar !== false);
      const filteredInner = inner.filter(s =>
        canShowChildMenuItem(permissionKey(s), isSuperAdmin, mergedPerms),
      );
      if (filteredInner.length) {
        out.push({ ...ch, children: filteredInner });
      }
      continue;
    }
    if (canShowChildMenuItem(permissionKey(ch), isSuperAdmin, mergedPerms)) {
      out.push(ch);
    }
  }
  return out;
}

function filterSuperAdminOnly(items: NavMenuItem[], isStrictSuperAdmin: boolean): NavMenuItem[] {
  return items
    .filter(it => !it.superAdminOnly || isStrictSuperAdmin)
    .map(it => {
      if (!it.children?.length) return it;
      const children = filterSuperAdminOnly(it.children, isStrictSuperAdmin);
      if (children.length === 0 && it.superAdminOnly) return null;
      return { ...it, children };
    })
    .filter((it): it is NavMenuItem => it != null);
}

export function filterNavByPermissions(
  menuItems: NavMenuItem[],
  isSuperAdmin: boolean,
  mergedPerms: Set<string>,
  permsLoading = false,
  isStrictSuperAdmin = false,
): NavMenuItem[] {
  const filterTree = (items: NavMenuItem[]): NavMenuItem[] => {
    const out: NavMenuItem[] = [];
    for (const item of items) {
      if (permsLoading && !isSuperAdmin) {
        const visibleChildren =
          item.path === '/contract'
            ? sidebarVisibleContractChildren(item.children)
            : (item.children?.filter(ch => ch.showInSidebar !== false) ?? []);
        if (visibleChildren.length > 0) {
          out.push({ ...item, children: visibleChildren });
        } else {
          out.push(item);
        }
        continue;
      }
      const isBaseData = item.path === '/base-data';
      const isTasks = item.path === '/tasks';
      if (!isSuperAdmin && !isBaseData && !isTasks && !canShowTopMenuPath(item.path, isSuperAdmin, mergedPerms)) {
        continue;
      }

      if (isBaseData) {
        const visibleChildren = item.children?.filter(ch => ch.showInSidebar !== false) ?? [];
        if (visibleChildren.length > 0) {
          out.push({ ...item, children: visibleChildren });
        } else if (!item.children?.length) {
          out.push(item);
        }
        continue;
      }

      if (isTasks) {
        const visibleChildren = item.children?.filter(ch => ch.showInSidebar !== false) ?? [];
        if (visibleChildren.length > 0) {
          out.push({ ...item, children: visibleChildren });
        } else if (!item.children?.length) {
          out.push(item);
        }
        continue;
      }

      const visibleChildren =
        item.path === '/contract'
          ? sidebarVisibleContractChildren(item.children)
          : (item.children?.filter(ch => ch.showInSidebar !== false) ?? []);
      if (!visibleChildren.length) {
        out.push(item);
        continue;
      }

      let children: NavMenuItem[];
      if (item.path === '/contract') {
        children = filterContractChildren(visibleChildren, isSuperAdmin, mergedPerms);
        if (!permsLoading) {
          const hasTpl = children.some(ch => ch.path === '/contract/templates' && ch.children?.length);
          const tpl = visibleChildren.find(ch => ch.path === '/contract/templates' && ch.children?.length);
          if (
            tpl &&
            !hasTpl &&
            (isSuperAdmin ||
              mergedPerms.has('合同模板库') ||
              implicitContractTemplateMenuAccess(mergedPerms))
          ) {
            const remIdx = children.findIndex(ch => ch.path.startsWith('/contract/reminders'));
            const injected = {
              ...CONTRACT_TEMPLATE_MENU_WRAPPER,
              children: CONTRACT_TEMPLATE_MENU_WRAPPER.children?.map(c => ({ ...c })),
            };
            if (remIdx >= 0) {
              children = [...children.slice(0, remIdx), injected, ...children.slice(remIdx)];
            } else {
              children = [...children, injected];
            }
          }
        }
      } else {
        children = visibleChildren.filter(ch =>
          canShowChildMenuItem(permissionKey(ch), isSuperAdmin, mergedPerms),
        );
      }

      if (children.length === 0) {
        continue;
      }
      out.push({ ...item, children });
    }
    return out;
  };

  return filterSuperAdminOnly(filterTree(menuItems), isStrictSuperAdmin);
}

/**
 * 合并当前用户所有角色的 permissions，并过滤菜单树。
 * 仅具备对应权限键的角色才可见菜单（超级管理员除外）。
 * @param mergedPerms 由父组件传入 {@link useMergedRolePermissions}，避免重复请求。
 */
export function useFilteredMenuItems(
  menuItems: NavMenuItem[],
  mergedPerms: Set<string>,
  permsLoading = false,
): NavMenuItem[] {
  const { user, isSuperAdmin, isStrictSuperAdmin } = useAuth();

  return useMemo(() => {
    if (!user) return menuItems;
    return filterNavByPermissions(menuItems, isSuperAdmin, mergedPerms, permsLoading, isStrictSuperAdmin);
  }, [user, isSuperAdmin, isStrictSuperAdmin, mergedPerms, permsLoading, menuItems]);
}
