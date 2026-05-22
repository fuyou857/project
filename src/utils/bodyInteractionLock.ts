type BodyStyleSnapshot = {
  overflow: string;
  pointerEvents: string;
};

let lockCount = 0;
let snapshot: BodyStyleSnapshot | null = null;

function getBody(): HTMLElement | null {
  return typeof document !== 'undefined' ? document.body : null;
}

/** Acquire a ref-counted body scroll / pointer-events lock. Returns a release function. */
export function acquireBodyInteractionLock(): () => void {
  const body = getBody();
  if (!body) return () => undefined;

  if (lockCount === 0) {
    snapshot = {
      overflow: body.style.overflow,
      pointerEvents: body.style.pointerEvents,
    };
    body.style.overflow = 'hidden';
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseBodyInteractionLock();
  };
}

/** Release one body interaction lock acquired via acquireBodyInteractionLock. */
export function releaseBodyInteractionLock(): void {
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount !== 0) return;

  const body = getBody();
  if (!body) {
    snapshot = null;
    return;
  }

  if (snapshot) {
    body.style.overflow = snapshot.overflow;
    body.style.pointerEvents = snapshot.pointerEvents;
  } else {
    body.style.overflow = '';
    body.style.pointerEvents = '';
  }
  snapshot = null;
}

/** Force-clear all locks — safety net after modal teardown. */
export function resetBodyInteractionLock(): void {
  lockCount = 0;
  const body = getBody();
  if (body) {
    body.style.overflow = '';
    body.style.pointerEvents = '';
  }
  snapshot = null;
}

/** @internal test helper */
export function getBodyInteractionLockCountForTests(): number {
  return lockCount;
}
