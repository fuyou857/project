import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILE_PICKER_SUPPRESS_MS } from './useSafeFileInput';

describe('useSafeFileInput constants', () => {
  it('suppress window covers focus bounce after native dialog cancel', () => {
    expect(FILE_PICKER_SUPPRESS_MS).toBeGreaterThanOrEqual(800);
  });
});

describe('file picker session guard (logic)', () => {
  let pickerSession = false;
  let suppressUntil = 0;
  let now = 1000;

  const releasePickerSession = () => {
    pickerSession = false;
    suppressUntil = now + FILE_PICKER_SUPPRESS_MS;
  };

  const openPicker = () => {
    if (pickerSession) return false;
    if (now < suppressUntil) return false;
    pickerSession = true;
    return true;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    now = 1000;
    vi.setSystemTime(now);
    pickerSession = false;
    suppressUntil = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks reopen while suppress window active after cancel', () => {
    expect(openPicker()).toBe(true);
    releasePickerSession();
    expect(openPicker()).toBe(false);

    now += FILE_PICKER_SUPPRESS_MS - 1;
    vi.setSystemTime(now);
    expect(openPicker()).toBe(false);

    now += 2;
    vi.setSystemTime(now);
    expect(openPicker()).toBe(true);
  });

  it('blocks concurrent picker sessions', () => {
    expect(openPicker()).toBe(true);
    expect(openPicker()).toBe(false);
    releasePickerSession();
  });
});
