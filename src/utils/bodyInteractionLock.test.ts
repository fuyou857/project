import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  acquireBodyInteractionLock,
  getBodyInteractionLockCountForTests,
  releaseBodyInteractionLock,
  resetBodyInteractionLock,
} from './bodyInteractionLock';

function createMockBody() {
  const style: { overflow: string; pointerEvents: string } = {
    overflow: '',
    pointerEvents: '',
  };
  return {
    style,
  } as unknown as HTMLElement;
}

describe('bodyInteractionLock', () => {
  let mockBody: HTMLElement;

  beforeEach(() => {
    resetBodyInteractionLock();
    mockBody = createMockBody();
    (globalThis as { document?: Document }).document = {
      body: mockBody,
    } as Document;
  });

  afterEach(() => {
    resetBodyInteractionLock();
    delete (globalThis as { document?: Document }).document;
  });

  it('locks overflow on first acquire', () => {
    acquireBodyInteractionLock();
    expect(mockBody.style.overflow).toBe('hidden');
    expect(getBodyInteractionLockCountForTests()).toBe(1);
  });

  it('restores original overflow after final release', () => {
    mockBody.style.overflow = 'scroll';
    const release = acquireBodyInteractionLock();
    expect(mockBody.style.overflow).toBe('hidden');
    release();
    expect(mockBody.style.overflow).toBe('scroll');
    expect(getBodyInteractionLockCountForTests()).toBe(0);
  });

  it('supports nested locks from invoice entry and list modals', () => {
    const releaseEntry = acquireBodyInteractionLock();
    const releaseList = acquireBodyInteractionLock();
    expect(getBodyInteractionLockCountForTests()).toBe(2);
    expect(mockBody.style.overflow).toBe('hidden');

    releaseEntry();
    expect(getBodyInteractionLockCountForTests()).toBe(1);
    expect(mockBody.style.overflow).toBe('hidden');

    releaseList();
    expect(getBodyInteractionLockCountForTests()).toBe(0);
    expect(mockBody.style.overflow).toBe('');
    expect(mockBody.style.pointerEvents).toBe('');
  });

  it('resetBodyInteractionLock clears stale locks after modal teardown', () => {
    acquireBodyInteractionLock();
    acquireBodyInteractionLock();
    resetBodyInteractionLock();
    expect(getBodyInteractionLockCountForTests()).toBe(0);
    expect(mockBody.style.overflow).toBe('');
    expect(mockBody.style.pointerEvents).toBe('');
  });

  it('releaseBodyInteractionLock is safe when called without acquire', () => {
    releaseBodyInteractionLock();
    expect(getBodyInteractionLockCountForTests()).toBe(0);
  });
});
