import { useState, useEffect } from 'react';
import { type DocxVariableToken } from '../../utils/docxVariables';

interface ContractPreviewHtmlProps {
  htmlTemplate: string;
  variables: Record<string, string>;
  variableTokens: DocxVariableToken[];
  richTextContent?: string; // 编辑器内容
}

export default function ContractPreviewHtml({ htmlTemplate, variables, variableTokens, richTextContent }: ContractPreviewHtmlProps) {
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (richTextContent) {
      // 如果有编辑器内容，优先显示编辑器内容
      setPreviewHtml(richTextContent);
      return;
    }

    if (!htmlTemplate) {
      setPreviewHtml('');
      return;
    }

    // 替换变量占位符
    let replacedHtml = htmlTemplate;
    variableTokens.forEach(token => {
      const placeholder = `{{${token.label}}}`;
      let value = variables[token.placeholder] || '';
      
      // 处理附件变量，将其显示为图片
      if (value.startsWith('data:image/') || value.startsWith('http://') || value.startsWith('https://')) {
        value = `<img src="${value}" alt="附件" style="max-width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 4px;" />`;
      }
      
      replacedHtml = replacedHtml.replace(new RegExp(placeholder, 'g'), value);
    });

    setPreviewHtml(replacedHtml);
  }, [htmlTemplate, variables, variableTokens, richTextContent]);

  if (!htmlTemplate && !richTextContent) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        请先上传模板文件
      </div>
    );
  }

  return (
    <div className="relative border border-gray-200 rounded-lg overflow-hidden">
      <div className="absolute top-0 left-0 right-0 bg-gray-100 px-4 py-2 border-b border-gray-200 text-sm text-gray-600">
        预览（排版参考，最终以下载Word文档为准）
      </div>
      <div className="pt-10 p-4 bg-white min-h-[400px] overflow-auto">
        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
    </div>
  );
}
