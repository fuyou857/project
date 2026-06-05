import { describe, expect, it } from 'vitest';
import {
  permissionKey,
  buildNavChildToParentPathMap,
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

describe('buildNavChildToParentPathMap', () => {
  const sample: NavMenuItemLike[] = [
    {
      path: '/machines',
      label: '机械管理',
      children: [
        { path: '/machines/list', label: '机械台账' },
        { path: '/machine-shift', label: '机械台班' },
      ],
    },
    {
      path: '/contract',
      label: '合同管理',
      children: [
        {
          path: '/contract/templates',
          label: '合同模板管理',
          children: [{ path: '/contract/templates/generation', label: '合同生成管理' }],
        },
      ],
    },
  ];

  it('maps child paths to top-level parent even when prefix differs', () => {
    const map = buildNavChildToParentPathMap(sample);
    expect(map.get('/machines')).toBe('/machines');
    expect(map.get('/machines/list')).toBe('/machines');
    expect(map.get('/machine-shift')).toBe('/machines');
  });

  it('maps nested children to top-level parent', () => {
    const map = buildNavChildToParentPathMap(sample);
    expect(map.get('/contract/templates')).toBe('/contract');
    expect(map.get('/contract/templates/generation')).toBe('/contract');
  });
});
