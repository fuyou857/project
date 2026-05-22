import { useEffect } from 'react';
import { acquireBodyInteractionLock } from '../utils/bodyInteractionLock';

/** Ref-counted body scroll lock while `active` is true. */
export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    return acquireBodyInteractionLock();
  }, [active]);
}
