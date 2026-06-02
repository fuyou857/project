export type ErrorLevel = 'info' | 'warning' | 'error' | 'fatal';

export interface ErrorHandlerOptions {
  showMessage?: boolean;
  defaultMessage?: string;
  level?: ErrorLevel;
  onError?: (error: Error) => void;
  onMessage?: (level: ErrorLevel, message: string) => void;
}

const LEVEL_LABELS: Record<ErrorLevel, string> = {
  info: '提示',
  warning: '警告',
  error: '错误',
  fatal: '严重错误',
};

function getLevelPrefix(level: ErrorLevel): string {
  return `[${LEVEL_LABELS[level]}]`;
}

export async function handleAsync<T>(
  promise: Promise<T>,
  options?: ErrorHandlerOptions
): Promise<T | null> {
  const {
    showMessage = true,
    defaultMessage = '操作失败，请重试',
    level = 'error',
    onError,
    onMessage,
  } = options || {};

  try {
    return await promise;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`${getLevelPrefix(level)}`, err);

    if (showMessage) {
      const errorMessage = err.message || defaultMessage;
      onMessage?.(level, errorMessage);
    }

    onError?.(err);
    return null;
  }
}

export function withErrorHandler<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  options?: ErrorHandlerOptions
): T {
  return (async (...args: never[]) => {
    return handleAsync(fn(...args), options);
  }) as T;
}

export async function safeExecute<T>(
  fn: () => Promise<T>,
  defaultValue?: T,
  options?: ErrorHandlerOptions
): Promise<T | undefined> {
  const result = await handleAsync(fn(), options);
  return result ?? defaultValue;
}