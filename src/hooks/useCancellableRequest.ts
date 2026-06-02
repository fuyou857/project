import { useRef, useCallback, useEffect } from 'react';

interface CancellablePromise<T> {
  promise: Promise<T>;
  abort: () => void;
}

export function useCancellableRequest() {
  const abortControllersRef = useRef<AbortController[]>([]);

  const cancellableRequest = useCallback(<T,>(
    url: string,
    options?: RequestInit
  ): CancellablePromise<T> => {
    const abortController = new AbortController();
    abortControllersRef.current.push(abortController);

    const promise = fetch(url, {
      ...options,
      signal: abortController.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      return response.json() as T;
    });

    const abort = () => {
      abortController.abort();
    };

    return { promise, abort };
  }, []);

  const cancellableSupabaseRequest = useCallback(<T,>(
    requestPromise: Promise<T>
  ): CancellablePromise<T> => {
    let isCancelled = false;

    const promise = new Promise<T>((resolve, reject) => {
      requestPromise
        .then((result) => {
          if (!isCancelled) resolve(result);
        })
        .catch((error) => {
          if (!isCancelled) reject(error);
        });
    });

    const abort = () => {
      isCancelled = true;
    };

    return { promise, abort };
  }, []);

  const cancelAll = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
    });
    abortControllersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  return {
    cancellableRequest,
    cancellableSupabaseRequest,
    cancelAll,
  };
}