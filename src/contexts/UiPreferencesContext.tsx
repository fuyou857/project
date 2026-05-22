import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type TableDensity = 'comfortable' | 'compact';

const STORAGE_KEY = 'ciond-ui-table-density';

type UiPreferencesContextValue = {
  tableDensity: TableDensity;
  setTableDensity: (d: TableDensity) => void;
  tableCellClass: string;
  tableHeadCellClass: string;
};

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

function readStoredDensity(): TableDensity {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'compact' || v === 'comfortable') return v;
  } catch {
    /* ignore */
  }
  return 'comfortable';
}

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [tableDensity, setTableDensityState] = useState<TableDensity>(() =>
    typeof window !== 'undefined' ? readStoredDensity() : 'comfortable',
  );

  const setTableDensity = useCallback((d: TableDensity) => {
    setTableDensityState(d);
    try {
      localStorage.setItem(STORAGE_KEY, d);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setTableDensityState(readStoredDensity());
  }, []);

  const value = useMemo<UiPreferencesContextValue>(() => {
    const compact = tableDensity === 'compact';
    return {
      tableDensity,
      setTableDensity,
      tableCellClass: compact ? 'py-1.5 px-2 text-xs' : 'py-3 px-4 text-sm',
      tableHeadCellClass: compact ? 'py-1.5 px-2 text-xs' : 'py-3 px-4 text-sm',
    };
  }, [tableDensity, setTableDensity]);

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences(): UiPreferencesContextValue {
  const ctx = useContext(UiPreferencesContext);
  if (!ctx) {
    return {
      tableDensity: 'comfortable',
      setTableDensity: (_d: TableDensity) => undefined,
      tableCellClass: 'py-3 px-4 text-sm',
      tableHeadCellClass: 'py-3 px-4 text-sm',
    };
  }
  return ctx;
}
