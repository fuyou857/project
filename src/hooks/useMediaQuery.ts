import { useEffect, useState } from 'react';

/** Matches CSS max-width: (breakpoint - 1)px — mobile-first companion to Tailwind `md` (768). */
export function useMediaQueryMaxWidth(maxWidthPx: number): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${maxWidthPx}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [maxWidthPx]);

  return matches;
}
