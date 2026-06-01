import { useState, useCallback, useRef } from 'react';

export default function FileUploadDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<string[]>([]);

  const addLog = (msg: string) => {
    logRef.current.push(`${new Date().toLocaleTimeString()}: ${msg}`);
    setLogs([...logRef.current]);
    console.log(`[FileUploadDebug] ${msg}`);
  };

  const handleDivClick = useCallback((e: React.MouseEvent) => {
    addLog(`Div onClick triggered, target: ${(e.target as HTMLElement).tagName}, currentTarget: ${(e.currentTarget as HTMLElement).tagName}`);
    e.preventDefault();
    e.stopPropagation();

    addLog(`Calling input.click(), input exists: !!inputRef.current = ${!!inputRef.current}`);
    if (inputRef.current) {
      addLog(`input.disabled = ${inputRef.current.disabled}`);
      addLog(`input.type = ${inputRef.current.type}`);

      try {
        inputRef.current.click();
        addLog('input.click() called successfully');
      } catch (err: unknown) {
        addLog(`Error calling input.click(): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addLog(`File input changed, files length: ${e.target.files?.length || 0}`);
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach((file, i) => {
        addLog(`  File ${i + 1}: ${file.name} (${file.size} bytes, ${file.type})`);
      });
    }
    e.target.value = '';
  }, []);

  const clearLogs = () => {
    logRef.current = [];
    setLogs([]);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">文件上传调试工具</h1>

      <div
        className="relative rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-6 text-center bg-white border-blue-200 hover:border-blue-500 hover:shadow-md cursor-pointer group"
        role="button"
        tabIndex={0}
        aria-label="点击或拖拽上传发票文件"
        onClick={handleDivClick}
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white">
          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 640 512" height="24" width="24">
            <path d="M537.6 226.6c4.1-10.7 6.4-22.4 6.4-34.6 0-53-43-96-96-96-19.7 0-38.1 6-53.3 16.2C367 64.2 315.3 32 256 32c-88.4 0-160 71.6-160 160 0 2.7.1 5.4.2 8.1C40.2 219.8 0 273.2 0 336c0 79.5 64.5 144 144 144h368c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4zM393.4 288H328v112c0 8.8-7.2 16-16 16h-48c-8.8 0-16-7.2-16-16V288h-65.4c-14.3 0-21.4-17.2-11.3-27.3l105.4-105.4c6.2-6.2 16.4-6.2 22.6 0l105.4 105.4c10.1 10.1 2.9 27.3-11.3 27.3z"></path>
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-700">点击或拖拽上传发票</p>
          <p className="text-[10px] text-slate-400">支持 JPG, PNG, PDF, OFD (最大 12MB)</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,.ofd,image/jpeg,image/jpg,image/png,application/pdf,application/ofd,application/vnd.ofd"
          multiple
          onChange={handleInputChange}
          className="hidden"
          tabIndex={-1}
        />
      </div>

      <div className="bg-slate-900 rounded-xl p-4 text-green-400 font-mono text-xs max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-2 sticky top-0 bg-slate-900 pb-2 border-b border-slate-700">
          <span className="font-bold">调试日志</span>
          <button
            onClick={clearLogs}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
          >
            清除日志
          </button>
        </div>
        <pre className="whitespace-pre-wrap">{logs.join('\n') || '暂无日志，请点击上方上传区域...'}</pre>
      </div>
    </div>
  );
}