import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/index.css';
import './utils/uiMetrics';
import './services/operationTracker';

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Global Error] Unhandled Promise Rejection:', event.reason);
});

window.addEventListener('error', (event) => {
  console.error('[Global Error] Uncaught Error:', event.error);
});

if (process.env.NODE_ENV === 'production' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
