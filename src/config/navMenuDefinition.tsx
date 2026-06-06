/**
 * 侧栏菜单与「角色 → 分配权限」的单一数据源。
 * 新增顶层模块或子菜单时只改此处，权限矩阵与菜单过滤会自动同步；
 * 须同步 routes.tsx、routePermissions.ts（特例），并运行 `npm run check:nav-routes`（CI 已接入）。
 * 各分校/公司下的数据范围由业务表 company_id 与 RLS 等控制；此处仅管功能入口是否可见。
 */
import {
  FaHome,
  FaProjectDiagram,
  FaHandshake,
  FaFileSignature,
  FaFileContract,
  FaMoneyBillWave,
  FaStamp,
  FaTools,
  FaCogs,
  FaUsers,
  FaUserFriends,
  FaExclamationTriangle,
  FaCog,
  FaPlus,
  FaBuilding,
  FaUserTie,
  FaKey,
  FaClipboardList,
  FaBell,
  FaFileAlt,
  FaTrash,
  FaChartBar,
} from 'react-icons/fa';
import type { NavMenuItem } from '../types/navMenu';
import {
  permissionKey as permissionKeyImpl,
  buildTopPathRequiresAnyPermFromNav,
} from './navPermissionHelpers';

export function permissionKey(item: NavMenuItem): string {
  return permissionKeyImpl(item);
}

/** 合同模板：侧栏二级分组「合同模板管理」下三级「合同模板库」；父级不单独作为侧栏链接、不出现在顶部主导航 */
export const CONTRACT_TEMPLATE_MENU_WRAPPER: NavMenuItem = {
  path: '/contract/templates',
  icon: FaFileAlt,
  label: '合同模板管理',
  permKey: '合同模板库',
  showInSidebar: false,
  hideFromTopNav: true,
  children: [
    {
      path: '/contract/templates',
      icon: FaFileAlt,
      label: '合同模板库',
      permKey: '合同模板库',
    },
    {
      path: '/contract/templates/generation',
      icon: FaFileSignature,
      label: '合同生成管理',
      permKey: '合同模板库',
    },
    {
      path: '/contract/templates/my-generated',
      icon: FaClipboardList,
      label: '我生成的合同',
      permKey: '合同模板库',
    },
    {
      path: '/contract/templates/my-generated/trash',
      icon: FaTrash,
      label: '合同回收站',
      permKey: '合同模板库',
    },
  ],
};

function flattenNavLeavesForAssign(children: NavMenuItem[]): { key: string; label: string }[] {
  return children.flatMap(ch => {
    if (ch.children?.length) {
      return flattenNavLeavesForAssign(ch.children);
    }
    return [{ key: permissionKeyImpl(ch), label: ch.label }];
  });
}

/** 须在本文件内先于依赖它的函数声明，避免打包/初始化顺序导致「分配权限」清单缺项 */
export const NAV_MENU_ITEMS: NavMenuItem[] = [
  {
    path: '/dashboard',
    icon: FaHome,
    label: '首页',
    children: [{ path: '/dashboard', icon: FaHome, label: '数据概览' }],
  },
  {
    path: '/projects',
    icon: FaProjectDiagram,
    label: '项目管理',
    children: [
      { path: '/projects', icon: FaProjectDiagram, label: '项目列表' },
      { path: '/projects/new', icon: FaPlus, label: '新建项目' },
      {
        path: '/projects',
        icon: FaProjectDiagram,
        label: '项目详情',
        permKey: '项目详情',
        showInSidebar: false,
      },
    ],
  },
  {
    path: '/base-data',
    icon: FaBuilding,
    label: '基础数据',
    children: [
      { path: '/base-data/party-a', icon: FaBuilding, label: '甲方单位' },
      { path: '/base-data/signatory', icon: FaFileSignature, label: '签约单位' },
      { path: '/base-data/party-b', icon: FaHandshake, label: '乙方单位' },
      { path: '/base-data/project-mgmt-staff', icon: FaUserTie, label: '项目部管理人员' },
    ],
  },
  {
    path: '/tasks',
    icon: FaClipboardList,
    label: '任务管理',
    children: [
      { path: '/tasks/published', icon: FaClipboardList, label: '我发布的任务' },
      { path: '/tasks/todo', icon: FaClipboardList, label: '我的待办任务' },
      { path: '/tasks/involved', icon: FaClipboardList, label: '我参与的任务' },
      { path: '/tasks/stats', icon: FaClipboardList, label: '任务统计', permKey: '任务统计' },
      { path: '/messages', icon: FaBell, label: '消息中心', permKey: '消息中心' },
      { path: '/approval', icon: FaClipboardList, label: '审批中心', permKey: '审批中心' },
    ],
  },
  {
    path: '/contract',
    icon: FaFileContract,
    label: '合同管理',
    children: [
      { path: '/contract/income/list', icon: FaFileContract, label: '收入合同签约管理' },
      { path: '/contract/income/supplement', icon: FaFileContract, label: '补充协议签约管理' },
      { path: '/contract/income/variation', icon: FaFileContract, label: '变更签证' },
      { path: '/contract/income/deduction', icon: FaFileContract, label: '扣款登记' },
      { path: '/contract/income/output', icon: FaFileContract, label: '产值确认' },
      { path: '/contract/income/settlement', icon: FaFileContract, label: '合同结算' },
      { path: '/contract/expense/list', icon: FaFileContract, label: '支出合同签约管理' },
      { path: '/contract/expense/supplement', icon: FaFileContract, permKey: '支出补充协议签约管理', label: '支出·补充协议签约管理' },
      { path: '/contract/expense/variation', icon: FaFileContract, permKey: '支出变更签证', label: '支出·变更签证' },
      { path: '/contract/expense/deduction', icon: FaFileContract, permKey: '支出扣款登记', label: '支出·扣款登记' },
      { path: '/contract/expense/performance', icon: FaFileContract, label: '合同履约' },
      { path: '/contract/expense/settlement', icon: FaFileContract, permKey: '支出合同结算', label: '支出·合同结算' },
      CONTRACT_TEMPLATE_MENU_WRAPPER,
      { path: '/contract/reminders', icon: FaBell, label: '合同提醒中心' },
      { path: '/contract/reminders/settings', icon: FaCog, label: '提醒规则设置' },
    ],
  },
  {
    path: '/finance',
    icon: FaMoneyBillWave,
    label: '财务管理',
    children: [
      { path: '/finance/invoice', icon: FaFileContract, label: '收入发票开具' },
      { path: '/finance/invoice-list', icon: FaFileContract, label: '收入发票列表' },
      { path: '/finance/tax-debt', icon: FaFileContract, label: '欠税列表' },
      { path: '/finance/receipt', icon: FaFileContract, label: '收款登记' },
      { path: '/finance/other-income', icon: FaFileContract, label: '其他收入' },
      { path: '/finance/cost-invoice', icon: FaFileContract, label: '成本发票录入' },
      { path: '/finance/cost-invoice-list', icon: FaFileContract, label: '成本发票列表' },
      { path: '/finance/payment', icon: FaFileContract, label: '工程款支付管理' },
      { path: '/finance/unpaid', icon: FaFileContract, label: '已开票未付款统计' },
      { path: '/finance/uninvoiced', icon: FaFileContract, label: '已付款缺票统计' },
    ],
  },
  {
    path: '/materials',
    icon: FaTools,
    label: '物资管理',
    children: [
      { path: '/materials/list', icon: FaTools, label: '物资清单' },
      { path: '/materials/inbound', icon: FaTools, label: '物资入库' },
      { path: '/material', icon: FaTools, label: '物资档案' },
      { path: '/purchase-order', icon: FaTools, label: '采购订单' },
      { path: '/inbound', icon: FaTools, label: '入库管理' },
      { path: '/fixed-asset', icon: FaTools, label: '固定资产' },
      { path: '/issue', icon: FaTools, label: '领料管理' },
    ],
  },
  {
    path: '/machines',
    icon: FaCogs,
    label: '机械管理',
    children: [
      { path: '/machines/list', icon: FaCogs, label: '机械台账' },
      { path: '/machines/report', icon: FaCogs, label: '机械报表' },
      { path: '/machine-shift', icon: FaCogs, label: '机械台班' },
      { path: '/machine-management', icon: FaCogs, label: '机械管理' },
    ],
  },
  {
    path: '/labor',
    icon: FaUsers,
    label: '劳务管理',
    children: [
      { path: '/labor/report', icon: FaUsers, label: '产值上报' },
      { path: '/labor/audit', icon: FaUsers, label: '产值审核' },
    ],
  },
  {
    path: '/workers',
    icon: FaUserFriends,
    label: '农民工管理',
    children: [
      { path: '/workers', icon: FaUserFriends, label: '农民工档案' },
      { path: '/workers/attendance', icon: FaUserFriends, label: '考勤记录' },
      { path: '/workers/payment', icon: FaUserFriends, label: '工资台账' },
    ],
  },
  {
    path: '/reports',
    icon: FaChartBar,
    label: '报表中心',
    children: [
      { path: '/reports/project-cost', icon: FaChartBar, label: '项目成本报表' },
    ],
  },
  {
    path: '/warnings',
    icon: FaExclamationTriangle,
    label: '预警中心',
    children: [
      { path: '/warnings', icon: FaExclamationTriangle, label: '预警列表' },
      { path: '/warnings/config', icon: FaExclamationTriangle, label: '预警配置' },
    ],
  },
  {
    path: '/seals',
    icon: FaStamp,
    label: '印章管理',
    children: [
      { path: '/seals', icon: FaStamp, label: '用章申请' },
      { path: '/seals/project', icon: FaStamp, label: '项目盖章情况' },
      { path: '/seals/temp', icon: FaStamp, label: '临时盖章情况' },
      { path: '/seals/borrow', icon: FaStamp, label: '印章外借情况' },
      { path: '/seals/history', icon: FaStamp, label: '历史记录' },
    ],
  },
  {
    path: '/admin',
    icon: FaCog,
    label: '系统管理',
    children: [
      { path: '/admin/users', icon: FaUsers, label: '用户管理' },
      { path: '/admin/roles', icon: FaCog, label: '角色管理' },
      { path: '/admin/companies', icon: FaBuilding, label: '公司管理' },
      { path: '/admin/logs', icon: FaFileSignature, label: '操作日志' },
      {
        path: '/admin/approval-workflow',
        icon: FaFileSignature,
        label: '审批流程配置',
        permKey: '审批流程配置',
        superAdminOnly: true,
      },
      { path: '/admin/backup', icon: FaCog, label: '备份设置' },
      {
        path: '/admin/keys',
        icon: FaCogs,
        label: '高级运维配置',
        superAdminOnly: true,
        hideFromTopNav: true,
        children: [
          {
            path: '/admin/keys',
            icon: FaKey,
            label: 'API 密钥中心',
            permKey: 'API密钥中心',
            superAdminOnly: true,
          },
        ],
      },
    ],
  },
];

/** 「分配权限」弹窗分组（与侧栏菜单一致；若运行环境中菜单缺「任务管理」则插入在合同管理前，避免清单漏项） */
export type PermissionAssignGroup = {
  path: string;
  name: string;
  items: { key: string; label: string }[];
};

function collectAssignableKeys(groups: PermissionAssignGroup[]): string[] {
  const s = new Set<string>();
  for (const g of groups) {
    for (const it of g.items) {
      s.add(it.key);
    }
  }
  return [...s];
}

export function getPermissionAssignGroups(): {
  groups: PermissionAssignGroup[];
  tasksInjected: boolean;
} {
  const groups: PermissionAssignGroup[] = NAV_MENU_ITEMS.map(top => ({
    path: top.path,
    name: top.label,
    items: flattenNavLeavesForAssign(top.children?.length ? top.children : [top]),
  }));

  if (groups.some(g => g.path === '/tasks')) {
    return { groups, tasksInjected: false };
  }
  const contractIdx = groups.findIndex(g => g.path === '/contract');
  const fallback: PermissionAssignGroup = {
    path: '/tasks',
    name: '任务管理',
    items: [
      { key: '我发布的任务', label: '我发布的任务' },
      { key: '我的待办任务', label: '我的待办任务' },
    ],
  };
  const next = [...groups];
  if (contractIdx >= 0) {
    next.splice(contractIdx, 0, fallback);
  } else {
    next.push(fallback);
  }
  return { groups: next, tasksInjected: true };
}

/** 顶层 path → 显示该模块所需的权限键（满足任一即可） */
export function buildTopPathRequiresAnyPerm(): Record<string, string[]> {
  return buildTopPathRequiresAnyPermFromNav(NAV_MENU_ITEMS);
}

/** 角色管理「分配权限」弹窗：分组与可选权限键（与菜单一致） */
export function getRolePermissionChecklist(): { name: string; children: string[] }[] {
  return getPermissionAssignGroups().groups.map(g => ({
    name: g.name,
    children: g.items.map(i => i.key),
  }));
}

/** 分配权限时展示 label，存储 permissionKey（收入/支出等同名菜单可区分） */
export function getRolePermissionChecklistDetailed(): {
  path: string;
  name: string;
  items: { key: string; label: string }[];
}[] {
  return getPermissionAssignGroups().groups;
}

/** 分配权限弹窗「全选所有」用：去重后的全部权限键 */
export function getAllAssignablePermissionKeys(): string[] {
  return collectAssignableKeys(getPermissionAssignGroups().groups);
}
