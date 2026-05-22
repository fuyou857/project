import { useState, useCallback } from 'react';
import { supabase } from '../supabase/client';

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

interface QueryParams {
  [key: string]: unknown;
}

interface UseApiOptions {
  table: string;
  select?: string;
  orderBy?: { column: string; ascending?: boolean };
}

function rowId(item: unknown): string | undefined {
  if (item && typeof item === 'object' && 'id' in item && typeof (item as { id: unknown }).id === 'string') {
    return (item as { id: string }).id;
  }
  return undefined;
}

export function useApi<T>(options: UseApiOptions) {
  const { table, select = '*', orderBy = { column: 'created_at', ascending: false } } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fetchData = useCallback(
    async (params?: QueryParams & PaginationParams) => {
      setLoading(true);
      setError(null);
      try {
        let query = supabase.from(table).select(select, { count: 'exact' });

        if (orderBy) {
          query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
        }

        if (params) {
          const { page, pageSize, ...filters } = params;

          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              if (key.includes('_like')) {
                query = query.ilike(key.replace('_like', ''), `%${value}%`);
              } else if (Array.isArray(value)) {
                query = query.in(key, value);
              } else if (typeof value === 'string' && value.includes('%')) {
                query = query.like(key, value);
              } else {
                query = query.eq(key, value);
              }
            }
          });

          if (page !== undefined && pageSize !== undefined) {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);
          }
        }

        const { data: result, error: err, count } = await query;

        if (err) throw err;
        setData((result ?? []) as T[]);
        return { data: result, count };
      } catch (err: unknown) {
        setError(err);
        return { error: err };
      } finally {
        setLoading(false);
      }
    },
    [table, select, orderBy],
  );

  const create = async (item: T | Partial<T>) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from(table)
        .insert(item as Record<string, unknown>)
        .select()
        .single();
      if (err) throw err;
      setData(prev => [result as T, ...prev]);
      return { data: result };
    } catch (err: unknown) {
      setError(err);
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  const update = async (id: string, updates: Partial<T>) => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase
        .from(table)
        .update(updates as Record<string, unknown>)
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      setData(prev => prev.map(item => (rowId(item) === id ? (result as T) : item)));
      return { data: result };
    } catch (err: unknown) {
      setError(err);
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.from(table).delete().eq('id', id);
      if (err) throw err;
      setData(prev => prev.filter(item => rowId(item) !== id));
      return { success: true };
    } catch (err: unknown) {
      setError(err);
      return { error: err };
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    fetchData,
    create,
    update,
    remove,
  };
}
