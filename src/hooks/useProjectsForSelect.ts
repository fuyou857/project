import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase/client';
import { projectSelectOptions } from '../components/ui/options';
import type { UiSelectOption } from '../components/ui/SearchableSelect';
import { useCompanyScope } from './useCompanyScope';

export interface ProjectForSelect {
  id: string;
  name: string;
  project_code?: string | null;
  project_manager?: string | null;
}

/** 下拉展示文案：含编号便于 SearchableSelect 按编号/名称检索 */
export function formatProjectSelectLabel(p: Pick<ProjectForSelect, 'id' | 'name' | 'project_code'>): string {
  const name = p.name?.trim() || p.id;
  const code = p.project_code?.trim();
  if (code) return `[${code}] ${name}`;
  return name;
}

type UseProjectsForSelectOptions = {
  /** 仅加载 status = active 的项目（机械台班等场景） */
  activeOnly?: boolean;
  emptyLabel?: string;
  filterEmptyLabel?: string;
};

/**
 * 从「项目管理」同源 projects 表加载当前公司范围内项目，供物资/机械/劳务/农民工等模块复用。
 */
export function useProjectsForSelect(opts: UseProjectsForSelectOptions = {}) {
  const { companyIds } = useCompanyScope();
  const [projects, setProjects] = useState<ProjectForSelect[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyIds.length) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      let query = supabase
        .from('projects')
        .select('id, name, project_code, project_manager')
        .in('company_id', companyIds)
        .order('name');
      if (opts.activeOnly) {
        query = query.eq('status', 'active');
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (!error) {
        setProjects((data ?? []) as ProjectForSelect[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyIds, opts.activeOnly]);

  const options = useMemo(
    () => projectSelectOptions(projects, opts.emptyLabel ?? '选择项目'),
    [projects, opts.emptyLabel],
  );

  const filterOptions = useMemo(
    () => projectSelectOptions(projects, opts.filterEmptyLabel ?? '全部项目'),
    [projects, opts.filterEmptyLabel],
  );

  const getProjectName = useCallback(
    (id: string) => projects.find(p => p.id === id)?.name ?? '-',
    [projects],
  );

  const getProjectLabel = useCallback(
    (id: string) => {
      const p = projects.find(item => item.id === id);
      return p ? formatProjectSelectLabel(p) : '-';
    },
    [projects],
  );

  const toValueLabelOptions = useCallback(
    (emptyLabel?: string): UiSelectOption[] =>
      emptyLabel
        ? [{ value: '', label: emptyLabel }, ...options.filter(o => o.value !== '')]
        : options.filter(o => o.value !== ''),
    [options],
  );

  return {
    projects,
    loading,
    options,
    filterOptions,
    getProjectName,
    getProjectLabel,
    toValueLabelOptions,
  };
}
