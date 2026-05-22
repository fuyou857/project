import { getStoredUser } from '../utils/sessionUser';

export interface LogData {
  userId?: string;
  userName?: string;
  module: string;
  actionType: string;
  elementId?: string;
  route: string;
  xCoordinate?: number;
  yCoordinate?: number;
  apiUrl?: string;
  statusCode?: number;
  durationMs?: number;
  errorLevel?: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
  errorStack?: string;
  logType: 'CLICK_OP' | 'ERROR' | 'API_REQ' | 'PAGE_VIEW';
}

class OperationTracker {
  private static instance: OperationTracker;
  private retryQueue: LogData[] = [];

  private constructor() {
    this.setupListeners();
    this.setupApiInterceptor();
  }

  public static getInstance(): OperationTracker {
    if (!OperationTracker.instance) {
      OperationTracker.instance = new OperationTracker();
    }
    return OperationTracker.instance;
  }

  private setupListeners() {
    if (typeof window === 'undefined') return;

    // 1. Mouse Click Tracking
    window.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const elementId = target.id || target.getAttribute('data-testid') || target.tagName;
      
      this.track({
        module: document.title || 'Unknown Module',
        actionType: 'CLICK',
        elementId,
        route: window.location.pathname,
        xCoordinate: Math.round(e.pageX),
        yCoordinate: Math.round(e.pageY),
        logType: 'CLICK_OP'
      });
    }, true);

    // 2. Error Tracking
    window.addEventListener('error', (e: ErrorEvent) => {
      this.track({
        module: 'SYSTEM',
        actionType: 'RUNTIME_ERROR',
        route: window.location.pathname,
        errorLevel: 'ERROR',
        errorStack: e.error?.stack || e.message,
        logType: 'ERROR'
      });
    });

    window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
      this.track({
        module: 'SYSTEM',
        actionType: 'PROMISE_ERROR',
        route: window.location.pathname,
        errorLevel: 'ERROR',
        errorStack: e.reason?.stack || String(e.reason),
        logType: 'ERROR'
      });
    });
  }

  private setupApiInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const start = Date.now();
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      
      try {
        const response = await originalFetch(...args);
        const duration = Date.now() - start;
        
        // Only track API calls to our backend, skip log recording API itself to avoid infinite loop
        if (!url.includes('/api/common/logs')) {
          this.track({
            module: 'API',
            actionType: 'REQUEST',
            apiUrl: url,
            statusCode: response.status,
            durationMs: duration,
            route: window.location.pathname,
            logType: response.ok ? 'API_REQ' : 'ERROR',
            errorLevel: response.ok ? undefined : 'WARNING'
          });
        }
        
        return response;
      } catch (err: any) {
        const duration = Date.now() - start;
        this.track({
          module: 'API',
          actionType: 'REQUEST_FAILED',
          apiUrl: url,
          durationMs: duration,
          route: window.location.pathname,
          errorLevel: 'ERROR',
          errorStack: err.message,
          logType: 'ERROR'
        });
        throw err;
      }
    };
  }

  public async track(data: LogData) {
    const user = getStoredUser();
    const fullLog: LogData = {
      ...data,
      userId: user?.id,
      userName: user?.real_name || user?.username || 'Guest'
    };

    // Use navigator.sendBeacon if available for non-blocking background transmission
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(fullLog)], { type: 'application/json' });
      const success = navigator.sendBeacon('/api/common/logs', blob);
      if (!success) {
        this.cacheLocally(fullLog);
      }
    } else {
      // Fallback to fetch
      try {
        await fetch('/api/common/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullLog),
          keepalive: true
        });
      } catch (err) {
        this.cacheLocally(fullLog);
      }
    }
  }

  private cacheLocally(log: LogData) {
    this.retryQueue.push(log);
    if (this.retryQueue.length > 50) this.retryQueue.shift(); // Max 50 cached logs
    
    // Attempt retry after 30s
    setTimeout(() => this.flushQueue(), 30000);
  }

  private async flushQueue() {
    if (this.retryQueue.length === 0) return;
    const logs = [...this.retryQueue];
    this.retryQueue = [];
    for (const log of logs) {
      await this.track(log);
    }
  }
}

export const tracker = OperationTracker.getInstance();
