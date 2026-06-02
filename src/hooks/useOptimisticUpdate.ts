import { useState, useCallback, useRef } from 'react';

interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error, rollbackData: T) => void;
}

export function useOptimisticUpdate<T, P = unknown>(
  mutationFn: (params: P) => Promise<T>,
  updateFn: (prevData: T, params: P) => T,
  options?: OptimisticUpdateOptions<T>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const rollbackRef = useRef<T | null>(null);

  const execute = useCallback(
    async (params: P, currentData: T) => {
      setIsLoading(true);
      setError(null);
      rollbackRef.current = currentData;

      const optimisticData = updateFn(currentData, params);
      options?.onSuccess?.(optimisticData);

      try {
        const result = await mutationFn(params);
        setIsLoading(false);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsLoading(false);
        if (rollbackRef.current !== null) {
          options?.onError?.(error, rollbackRef.current);
        }
        throw error;
      }
    },
    [mutationFn, updateFn, options]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return { execute, isLoading, error, reset };
}