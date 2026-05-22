import type { IconType } from 'react-icons';

export interface NavMenuItem {
  path: string;
  icon: IconType;
  label: string;
  children?: NavMenuItem[];
  group?: string;
  /** 写入 roles.permissions 的标识；默认与 label 相同 */
  permKey?: string;
  /** 为 false 时仅在「分配权限」中出现，用于详情页等不与侧栏重复的权限项 */
  showInSidebar?: boolean;
  /**
   * 为 true 时不出现在顶部蓝色主导航（仍可由侧栏/合同分组进入）。
   * 用于已并入「合同管理」的模板分组父级等。
   */
  hideFromTopNav?: boolean;
  /** 仅 roles.code = super_admin 可见（不含 admin 别名） */
  superAdminOnly?: boolean;
}
