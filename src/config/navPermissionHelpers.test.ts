import { describe, expect, it } from 'vitest';
import {
  permissionKey,
  buildTopPathRequiresAnyPermFromNav,
  type NavMenuItemLike,
} from './navPermissionHelpers';

describe('permissionKey', () => {
  it('uses permKey when set', () => {
    expect(permissionKey({ label: '同名', permKey: '支出变更签证' })).toBe('支出变更签证');
  });

  it('falls back to label', () => {
    expect(permissionKey({ label: '  产值上报  ' })).toBe('产值上报');
  });
});

describe('buildTopPathRequiresAnyPermFromNav', () => {
  const sample: NavMenuItemLike[] = [
    {
      path: '/dashboard',
      label: '首页',
      children: [{ path: '/dashboard', label: '数据概览' }],
    },
    {
      path: '/labor',
      label: '劳务管理',
      children: [
        { path: '/labor/report', label: '产值上报' },
        { path: '/labor/audit', label: '产值审核' },
      ],
    },
  ];

  it('maps top path to leaf permission keys', () => {
    const map = buildTopPathRequiresAnyPermFromNav(sample);
    expect(map['/dashboard']).toEqual(['数据概览']);
    expect(map['/labor']).toEqual(['产值上报', '产值审核']);
  });
});
