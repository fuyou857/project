import { useEffect, useRef, useState } from 'react';

interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  immediate?: boolean;
}

export function useAsync<T>(
  asyncFn: () => Promise<T>,
  options: UseAsyncOptions<T> = {},
  deps: React.DependencyList = [],
) {
  const { onSuccess, onError, immediate = true } = options;
  const isMounted = useRef(true);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      if (isMounted.current) {
        setData(result);
        onSuccess?.(result);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err as Error);
        onError?.(err as Error);
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    if (immediate) execute();
    return () => { isMounted.current = false; };
  }, deps);

  return { data, loading, error, execute };
}