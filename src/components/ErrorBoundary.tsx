import React from 'react';
import {
  CIOND_CHUNK_AUTO_RELOAD_SESSION_KEY,
  isWebpackChunkLoadError,
} from '../utils/webpackChunkLoadError';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 供线上在控制台输入 __CIOND_LAST_ERROR__ 查看（不依赖是否保留 console）
    try {
      (globalThis as unknown as { __CIOND_LAST_ERROR__?: Record<string, string | null | undefined> }).__CIOND_LAST_ERROR__ = {
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
      };
    } catch {
      /* ignore */
    }

    if (isWebpackChunkLoadError(error) && typeof sessionStorage !== 'undefined') {
      if (!sessionStorage.getItem(CIOND_CHUNK_AUTO_RELOAD_SESSION_KEY)) {
        sessionStorage.setItem(CIOND_CHUNK_AUTO_RELOAD_SESSION_KEY, '1');
        window.location.reload();
        return;
      }
    }

    console.error('[ErrorBoundary]', error?.message);
    console.error('[ErrorBoundary] stack', error?.stack);
    console.error('[ErrorBoundary] componentStack', errorInfo?.componentStack);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CIOND_CHUNK_AUTO_RELOAD_SESSION_KEY);
    }
    if (isWebpackChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const chunkFailed = isWebpackChunkLoadError(this.state.error);
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl">⚠️</span>
              </div>
              <h1 className="text-2xl font-bold text-white">出错了</h1>
              <p className="text-slate-400 mt-2">页面发生了意外错误</p>
              {chunkFailed && (
                <p className="text-amber-200/90 text-sm mt-3 text-left px-1">
                  检测到前端资源块加载失败，多为网站刚更新而当前页仍使用旧缓存。已尝试自动刷新一次；若仍失败请点「刷新页面」或关闭标签后重新打开。
                </p>
              )}
              <p className="text-slate-500 text-xs mt-3 text-left px-1">
                生产环境曾去掉全部 console，若控制台仍较空属历史构建；请重新部署当前代码。也可在控制台输入{' '}
                <code className="text-slate-300">__CIOND_LAST_ERROR__</code> 查看本次错误的堆栈对象。
              </p>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
              <p className="text-red-400 text-sm font-mono break-words whitespace-pre-wrap">
                {this.state.error?.message || '未知错误'}
              </p>
            </div>

            {(this.state.error?.stack || this.state.errorInfo?.componentStack) && (
              <details className="mb-6 text-left text-slate-400 text-xs border border-slate-600 rounded-lg p-3 bg-slate-900/50">
                <summary className="cursor-pointer text-slate-300 font-medium select-none">
                  技术详情（点开展开；可复制发给开发人员）
                </summary>
                {this.state.error?.stack && (
                  <pre className="mt-3 overflow-x-auto text-slate-500 font-mono whitespace-pre-wrap break-words">
                    {this.state.error.stack}
                  </pre>
                )}
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-3 overflow-x-auto text-slate-500 font-mono whitespace-pre-wrap break-words border-t border-slate-700 pt-3">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                {chunkFailed ? '重新加载' : '重试'}
              </button>
              <button
                onClick={() => {
                  if (typeof sessionStorage !== 'undefined') {
                    sessionStorage.removeItem(CIOND_CHUNK_AUTO_RELOAD_SESSION_KEY);
                  }
                  window.location.reload();
                }}
                className="flex-1 py-3 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
