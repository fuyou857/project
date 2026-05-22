import { describe, it, expect, vi, beforeEach } from 'vitest';

const { captured } = vi.hoisted(() => ({
  captured: { patch: undefined as Record<string, unknown> | undefined },
}));

vi.mock('../supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn((patch: Record<string, unknown>) => {
        captured.patch = patch;
        return {
          eq: vi.fn(() => ({
            is: vi.fn(() => Promise.resolve({ error: null })),
            not: vi.fn(() => ({
              is: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        };
      }),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

import { restoreGeneratedContractFromTrash, softDeleteGeneratedContract } from './contractGenerationService';

describe('contract template generated trash service (mocked client)', () => {
  beforeEach(() => {
    captured.patch = undefined;
    vi.clearAllMocks();
  });

  it('softDeleteGeneratedContract sets trimmed delete_reason and deleted_at', async () => {
    await softDeleteGeneratedContract({ id: 'g1', userId: 'u1', deleteReason: '  整理  ' });
    expect(captured.patch?.delete_reason).toBe('整理');
    expect(captured.patch?.deleted_by).toBe('u1');
    expect(typeof captured.patch?.deleted_at).toBe('string');
  });

  it('restoreGeneratedContractFromTrash clears trash columns', async () => {
    await restoreGeneratedContractFromTrash('g1', 'u1');
    expect(captured.patch?.deleted_at).toBeNull();
    expect(captured.patch?.delete_reason).toBeNull();
  });
});
