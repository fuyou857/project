import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferModalOpen } from './deferModalOpen';

describe('deferModalOpen', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'requestAnimationFrame',
      (cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('invokes open after microtask and animation frame', async () => {
    const open = vi.fn();

    deferModalOpen(open);
    expect(open).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(1);
  });
});
