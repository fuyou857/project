import { describe, expect, it } from 'vitest';
import { formatProjectSelectLabel } from './useProjectsForSelect';
import { projectSelectOptions } from '../components/ui/options';

describe('formatProjectSelectLabel', () => {
  it('includes project code for search and display', () => {
    expect(formatProjectSelectLabel({ id: '1', name: '星河湾', project_code: 'P2024-001' })).toBe(
      '[P2024-001] 星河湾',
    );
  });

  it('falls back to name only when code missing', () => {
    expect(formatProjectSelectLabel({ id: '1', name: '市政道路' })).toBe('市政道路');
  });
});

describe('projectSelectOptions', () => {
  it('builds searchable labels with code prefix', () => {
    const opts = projectSelectOptions([
      { id: 'a', name: '测试项目', project_code: 'XM001' },
    ]);
    expect(opts[1]?.label).toBe('[XM001] 测试项目');
  });
});
