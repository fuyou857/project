import { useCallback, useEffect, useState } from 'react';

/**
 * 实体选择器列表加载（PartyA / PartyB / 签章单位等共用）
 */
export function useEntityListLoader<T>(fetchList: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchList();
      setItems(data);
    } catch {
      /* 列表加载失败时保持空列表 */
    }
  }, [fetchList]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, setItems, refresh };
}
