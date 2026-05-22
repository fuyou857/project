import React, { useState } from 'react';
import OnlyOfficeEditor from '../components/contract/OnlyOfficeEditor';

const TestOnlyOffice: React.FC = () => {
  const [documentUrl, setDocumentUrl] = useState<string>(
    // 使用ONLYOFFICE官方示例文档
    'https://onlyo.co/3.0/samples/editor.docx'
  );
  
  const handleDocumentReady = () => undefined;

  const handleDocumentSaved = (_url: string) => {
    void _url;
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">ONLYOFFICE 编辑器测试</h1>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          文档URL
        </label>
        <input
          type="text"
          value={documentUrl}
          onChange={(e) => setDocumentUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">编辑器测试</h2>
        <div className="h-[600px]">
          <OnlyOfficeEditor
            documentUrl={documentUrl}
            documentTitle="测试文档.docx"
            height="100%"
            onDocumentReady={handleDocumentReady}
            onDocumentSaved={handleDocumentSaved}
            forceViewMode={false}
          />
        </div>
      </div>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">只读模式测试</h2>
        <div className="h-[300px]">
          <OnlyOfficeEditor
            documentUrl={documentUrl}
            documentTitle="测试文档.docx"
            height="100%"
            onDocumentReady={handleDocumentReady}
            forceViewMode={true}
          />
        </div>
      </div>
    </div>
  );
};

export default TestOnlyOffice;