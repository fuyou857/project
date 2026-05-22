/**
 * API 错误监控与上报工具
 * 文件路径：/www/wwwroot/ciond/src/utils/apiErrorMonitor.ts
 * 用途：在前端捕获 API 错误并上报到监控系统
 */

interface ApiErrorInfo {
  timestamp: string;
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string;
  userAgent: string;
  clientIp?: string;
  requestPayload?: Record<string, unknown>;
}

interface MonitoringConfig {
  enableConsoleCapture: boolean;
  enableErrorReporting: boolean;
  maxQueueSize: number;
  flushInterval: number;
  reportEndpoint: string;
  errorThreshold: number;
  warningThreshold: number;
}

const defaultConfig: MonitoringConfig = {
  enableConsoleCapture: true,
  enableErrorReporting: true,
  maxQueueSize: 100,
  flushInterval: 5000,
  reportEndpoint: '/api/monitoring/report-error',
  errorThreshold: 5,
  warningThreshold: 20,
};

class ApiErrorMonitor {
  private config: MonitoringConfig;
  private errorQueue: ApiErrorInfo[] = [];
  private flushTimer: number | null = null;
  private errorCountPerMinute: number = 0;
  private lastResetTime: number = Date.now();

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.init();
  }

  private init(): void {
    if (this.config.enableConsoleCapture) {
      this.setupConsoleCapture();
    }
    
    if (typeof window !== 'undefined') {
      this.setupNetworkErrorCapture();
      this.startPeriodicReset();
      this.startFlushTimer();
    }
  }

  private setupConsoleCapture(): void {
    const originalError = console.error;
    
    console.error = (...args: unknown[]) => {
      const message = args.map(arg => {
        if (arg instanceof Error) {
          return arg.message;
        }
        return String(arg);
      }).join(' ');

      if (this.isApiError(message)) {
        this.handleApiError({
          message,
          stack: '',
        });
      }

      originalError.apply(console, args);
    };
  }

  private setupNetworkErrorCapture(): void {
    // 捕获全局 fetch 错误
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const [url, options] = args;
      const method = options?.method || 'GET';
      
      try {
        const response = await originalFetch.apply(window, args);
        
        // 如果响应状态码表示错误
        if (response.status >= 400) {
          this.captureError({
            endpoint: String(url),
            method,
            statusCode: response.status,
            errorMessage: `HTTP ${response.status}: ${response.statusText}`,
          });
        }
        
        return response;
      } catch (error) {
        this.captureError({
          endpoint: String(url),
          method,
          statusCode: 0,
          errorMessage: error instanceof Error ? error.message : 'Network Error',
        });
        throw error;
      }
    };

    // 捕获 XMLHttpRequest 错误
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(
      method: string,
      url: string,
      ...rest: unknown[]
    ) {
      (this as XMLHttpRequest & { _method: string; _url: string })._method = method;
      (this as XMLHttpRequest & { _method: string; _url: string })._url = url;
      return originalXHROpen.apply(this, [method, url, ...rest] as Parameters<typeof originalXHROpen>);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      this.addEventListener('error', () => {
        const { _method, _url } = this as XMLHttpRequest & { _method: string; _url: string };
        this.monitor?.captureError({
          endpoint: _url,
          method: _method || 'GET',
          statusCode: 0,
          errorMessage: 'XHR Network Error',
        });
      });

      this.addEventListener('load', () => {
        if (this.status >= 400) {
          const { _method, _url } = this as XMLHttpRequest & { _method: string; _url: string };
          this.monitor?.captureError({
            endpoint: _url,
            method: _method || 'GET',
            statusCode: this.status,
            errorMessage: `HTTP ${this.status}: ${this.statusText}`,
          });
        }
      });

      return originalXHRSend.apply(this, args as Parameters<typeof originalXHROpen>);
    };
  }

  private isApiError(message: string): boolean {
    return (
      message.includes('Failed to load resource') ||
      message.includes('405') ||
      message.includes('NetworkError') ||
      message.includes('Network request failed')
    );
  }

  private handleApiError(error: { message: string; stack?: string }): void {
    // 解析错误信息
    const errorMessage = error.message;
    
    // 提取状态码
    const statusMatch = errorMessage.match(/(\d{3})/);
    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 0;
    
    // 提取端点
    const urlMatch = errorMessage.match(/(https?:\/\/[^\s]+)/);
    const endpoint = urlMatch ? urlMatch[1] : 'unknown';
    
    this.captureError({
      endpoint,
      method: 'UNKNOWN',
      statusCode,
      errorMessage,
    });
  }

  private captureError(error: Partial<ApiErrorInfo>): void {
    const errorInfo: ApiErrorInfo = {
      timestamp: new Date().toISOString(),
      endpoint: error.endpoint || 'unknown',
      method: error.method || 'UNKNOWN',
      statusCode: error.statusCode || 0,
      errorMessage: error.errorMessage || 'Unknown Error',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };

    this.errorQueue.push(errorInfo);
    this.errorCountPerMinute++;

    // 如果队列已满，立即刷新
    if (this.errorQueue.length >= this.config.maxQueueSize) {
      this.flush();
    }

    // 超过阈值，触发告警
    if (this.errorCountPerMinute >= this.config.errorThreshold) {
      this.triggerAlert();
    }
  }

  private startFlushTimer(): void {
    if (typeof window !== 'undefined') {
      this.flushTimer = window.setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  private startPeriodicReset(): void {
    // 每分钟重置错误计数
    if (typeof window !== 'undefined') {
      window.setInterval(() => {
        this.errorCountPerMinute = 0;
        this.lastResetTime = Date.now();
      }, 60000);
    }
  }

  private async flush(): Promise<void> {
    if (this.errorQueue.length === 0 || !this.config.enableErrorReporting) {
      return;
    }

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // 发送到服务器
      await fetch(this.config.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errors,
          metadata: {
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : 'unknown',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          },
        }),
      });
    } catch (error) {
      // 如果发送失败，放回队列
      this.errorQueue = [...errors, ...this.errorQueue];
      console.error('[ApiErrorMonitor] Failed to report errors:', error);
    }
  }

  private triggerAlert(): void {
    console.warn(
      `[ApiErrorMonitor] ⚠️ API 错误告警：检测到 ${this.errorCountPerMinute} 个错误/分钟（阈值: ${this.config.errorThreshold}）`
    );

    // 可以在这里添加更多的告警逻辑
    // 例如：发送 Slack 通知、发送邮件等
    
    // 避免重复告警
    if (this.errorCountPerMinute === this.config.errorThreshold) {
      this.sendBrowserNotification();
    }
  }

  private sendBrowserNotification(): void {
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      new Notification('API 错误告警', {
        body: `检测到 ${this.errorCountPerMinute} 个 API 错误，请检查系统状态。`,
        icon: '/favicon.ico',
        tag: 'api-error-alert',
      });
    }
  }

  // 公开方法
  public capture(error: Partial<ApiErrorInfo>): void {
    this.captureError(error);
  }

  public getErrorCount(): number {
    return this.errorCountPerMinute;
  }

  public getQueueSize(): number {
    return this.errorQueue.length;
  }

  public destroy(): void {
    if (this.flushTimer !== null) {
      window.clearInterval(this.flushTimer);
    }
    this.flush();
  }

  public static requestPermission(): Promise<NotificationPermission> {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      return Notification.requestPermission();
    }
    return Promise.resolve(Notification.permission);
  }
}

// 创建单例实例
const apiErrorMonitor = new ApiErrorMonitor({
  enableConsoleCapture: true,
  enableErrorReporting: false, // 暂时禁用服务器上报
  maxQueueSize: 50,
  flushInterval: 10000,
  errorThreshold: 10,
  warningThreshold: 30,
});

export default apiErrorMonitor;
export { ApiErrorMonitor, type ApiErrorInfo, type MonitoringConfig };
