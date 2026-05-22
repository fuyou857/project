import { useCallback, useState } from 'react';
import { runInvoiceOcr } from '../services/invoiceOcrService';
import { applyOcrPayloadToForm } from '../pages/finance/costInvoice/applyOcrToForm';
import type {
  CostInvoiceForm,
  InvoiceOcrFieldKey,
  OcrLogEntry,
  OcrUiStatus,
} from '../pages/finance/costInvoice/types';

function logId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function invoiceOcrStatusLabel(status: OcrUiStatus): string {
  if (status === 'pending') return '识别中';
  if (status === 'success') return '成功';
  if (status === 'partial') return '部分';
  if (status === 'failed') return '失败';
  return '待命';
}

type Options = {
  setForm: React.Dispatch<React.SetStateAction<CostInvoiceForm>>;
  onOcrStatusChange?: (status: OcrUiStatus) => void;
  onOcrComplete?: (form: CostInvoiceForm, status: OcrUiStatus) => void;
};

/** 成本发票 OCR 识别状态与回填（CostInvoiceEntryWorkspace 共用） */
export function useInvoiceOcrForm({ setForm, onOcrStatusChange, onOcrComplete }: Options) {
  const [ocrUiStatus, setOcrUiStatusState] = useState<OcrUiStatus>('idle');
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [ocrFilled, setOcrFilled] = useState<Partial<Record<InvoiceOcrFieldKey, boolean>>>({});
  const [manualKeys, setManualKeys] = useState<Set<InvoiceOcrFieldKey>>(new Set());
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [logs, setLogs] = useState<OcrLogEntry[]>([]);

  const setOcrUiStatus = useCallback(
    (status: OcrUiStatus) => {
      setOcrUiStatusState(status);
      onOcrStatusChange?.(status);
    },
    [onOcrStatusChange],
  );

  const pushLog = useCallback((level: OcrLogEntry['level'], message: string) => {
    setLogs((prev) =>
      [{ id: logId(), at: new Date().toLocaleTimeString('zh-CN', { hour12: false }), level, message }, ...prev].slice(
        0,
        30,
      ),
    );
  }, []);

  const touchManual = useCallback((key: InvoiceOcrFieldKey) => {
    setManualKeys((prev) => new Set(prev).add(key));
    setOcrFilled((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const resetOcrMeta = useCallback(() => {
    setOcrFilled({});
    setManualKeys(new Set());
    setOcrWarnings([]);
    setOcrUiStatus('idle');
  }, [setOcrUiStatus]);

  const runOcrPipeline = useCallback(
    async (urls: string[], files?: File[]) => {
      if (!urls.length) {
        setOcrUiStatus('idle');
        return;
      }
      setOcrUiStatus('pending');
      setOcrWarnings([]);
      setProgress(8);
      setProgressLabel('图片预处理…');
      pushLog('info', '开始调用本地 OCR 服务');
      const tick = window.setInterval(() => {
        setProgress((p) => (p < 88 ? p + 4 : p));
      }, 1200);
      try {
        setProgressLabel('文字抓取与字段解析…');
        const { data, error } = await runInvoiceOcr({ fileUrls: urls, files });
        clearInterval(tick);
        setProgress(100);
        if (error || !data) {
          setOcrUiStatus('failed');
          setOcrWarnings([error?.message || '识别失败']);
          pushLog('error', error?.message || '识别失败');
          return;
        }
        setOcrWarnings(data.warnings || []);
        const st = data.ocr_status === 'failed' ? 'failed' : data.ocr_status;
        setOcrUiStatus(st);
        let ocrFormSnapshot: CostInvoiceForm | null = null;
        setForm((prev) => {
          const { next, filled } = applyOcrPayloadToForm(prev, data, manualKeys);
          setOcrFilled((old) => ({ ...old, ...filled }));
          ocrFormSnapshot = next;
          return next;
        });
        pushLog('success', '识别完成，字段已回填');
        if (ocrFormSnapshot) {
          pushLog('info', `销售方：${ocrFormSnapshot.seller_name || '—'}，将校验基础数据乙方`);
          onOcrComplete?.(ocrFormSnapshot, st);
        }
        setProgressLabel('识别完成');
      } catch (e) {
        clearInterval(tick);
        setOcrUiStatus('failed');
        const msg = e instanceof Error ? e.message : String(e);
        setOcrWarnings([msg]);
        pushLog('error', msg);
      } finally {
        window.setTimeout(() => {
          setProgress(0);
          setProgressLabel('');
        }, 800);
      }
    },
    [manualKeys, onOcrComplete, pushLog, setForm, setOcrUiStatus],
  );

  return {
    ocrUiStatus,
    setOcrUiStatus,
    ocrWarnings,
    ocrFilled,
    manualKeys,
    progress,
    progressLabel,
    logs,
    pushLog,
    touchManual,
    runOcrPipeline,
    resetOcrMeta,
    setOcrFilled,
    setOcrWarnings,
  };
}

export type InvoiceOcrController = ReturnType<typeof useInvoiceOcrForm>;
