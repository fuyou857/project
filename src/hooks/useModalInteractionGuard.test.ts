import { describe, expect, it } from 'vitest';
import { MODAL_CLICK_THROUGH_GUARD_MS } from './useModalInteractionGuard';

describe('useModalInteractionGuard', () => {
  it('uses a guard window long enough to absorb open-button click-through', () => {
    expect(MODAL_CLICK_THROUGH_GUARD_MS).toBeGreaterThanOrEqual(200);
    expect(MODAL_CLICK_THROUGH_GUARD_MS).toBeLessThanOrEqual(500);
  });
});
