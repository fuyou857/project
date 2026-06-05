import { describe, expect, it } from 'vitest';
import { resolveMenuParentPath } from './menuAccess';

describe('resolveMenuParentPath', () => {
  it('keeps machine module sidebar under /machines for non-prefixed child routes', () => {
    expect(resolveMenuParentPath('/machines/list')).toBe('/machines');
    expect(resolveMenuParentPath('/machine-shift')).toBe('/machines');
    expect(resolveMenuParentPath('/machine-management')).toBe('/machines');
  });

  it('keeps materials module sidebar under /materials for legacy child routes', () => {
    expect(resolveMenuParentPath('/materials/list')).toBe('/materials');
    expect(resolveMenuParentPath('/material')).toBe('/materials');
    expect(resolveMenuParentPath('/material/abc')).toBe('/materials');
    expect(resolveMenuParentPath('/purchase-order')).toBe('/materials');
    expect(resolveMenuParentPath('/purchase-order/123')).toBe('/materials');
    expect(resolveMenuParentPath('/inbound')).toBe('/materials');
    expect(resolveMenuParentPath('/fixed-asset')).toBe('/materials');
    expect(resolveMenuParentPath('/issue')).toBe('/materials');
  });

  it('still resolves dynamic detail routes by prefix', () => {
    expect(resolveMenuParentPath('/projects/abc-123')).toBe('/projects');
    expect(resolveMenuParentPath('/contract/income/list/edit/1')).toBe('/contract');
  });
});
