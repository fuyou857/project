import { useEffect, useCallback, useRef } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcut(shortcuts: ShortcutConfig | ShortcutConfig[]) {
  const shortcutsRef = useRef<ShortcutConfig[]>(
    Array.isArray(shortcuts) ? shortcuts : [shortcuts]
  );

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const shortcut of shortcutsRef.current) {
      const isCtrl = shortcut.ctrl === event.ctrlKey;
      const isAlt = shortcut.alt === event.altKey;
      const isShift = shortcut.shift === event.shiftKey;
      const isMeta = shortcut.meta === event.metaKey;
      const isKey = event.key.toLowerCase() === shortcut.key.toLowerCase();

      if (isCtrl && isAlt && isShift && isMeta && isKey) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.handler(event);
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const SHORTCUTS = {
  SAVE: { ctrl: true, key: 's', handler: () => {} },
  CANCEL: { key: 'escape', handler: () => {} },
  SEARCH: { ctrl: true, key: 'f', handler: () => {} },
  NEW: { ctrl: true, key: 'n', handler: () => {} },
  DELETE: { key: 'delete', handler: () => {} },
};