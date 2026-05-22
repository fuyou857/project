import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaArrowLeft, FaSave, FaDownload, FaFileWord, FaFilePdf, FaMagic, FaEye } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { getTemplateById, getTemplateFileVersionUrl } from '../../services/contractTemplateLibraryService';
import { createGeneratedContract, runDocxFillAfterGeneratedContract } from '../../services/contractGenerationService';
import OnlyOfficeEditor from '../../components/contract/OnlyOfficeEditor';
import { saveAs } from 'file-saver';

function ContractTemplateEditorPage() {
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();
  const { user } = useAuth();
  const userId = user?.id;
  
  const [template, setTemplate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContractId, setGeneratedContractId] = useState<string | null>(null);
  
  // 加载模板数据
  useEffect(() => {
    if (!templateId) {
      navigate('/contract/templates');
      return;
    }
    
    const loadTemplate = async () => {
      setIsLoading(true);
      try {
        const data = await getTemplateById(templateId);
        if (data && data.versions && data.versions.length > 0) {
          setTemplate(data);
          const url = await getTemplateFileVersionUrl(data.versions[0].id);
          setDocumentUrl(url);
        } else {
          setError('模板或版本不存在');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : '加载模板失败';
        setError(msg.includes('签名') || msg.includes('storage') ? `加载模板 Word 文件失败：${msg}` : '加载模板失败');
        console.error('加载模板失败:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTemplate();
  }, [templateId, navigate]);
  
  // 保存：ONLYOFFICE 会通过「文件 → 保存」或自动保存触发服务端回调写回 Storage；此处仅作界面提示。
  const handleSaveTemplate = useCallback(async () => {
    if (!templateId || !template) return;

    setIsSaving(true);
    try {
      alert(
        '在线编辑的保存由 ONLYOFFICE 完成：请使用编辑器内「文件 → 保存」或等待自动保存。\n' +
          '保存成功后，系统会通过回调把 Word 写回当前模板版本对应的 Storage 路径。\n' +
          '若无法保存，请在 Supabase 部署 `onlyoffice-callback` Edge Function，并将 ONLYOFFICE_CALLBACK_URL 设为该函数的 HTTPS 地址（见 .env.example）。',
      );
    } catch (err) {
      alert('保存模板失败');
      console.error('保存模板失败:', err);
    } finally {
      setIsSaving(false);
    }
  }, [templateId, template]);
  
  // 下载Word文档
  const handleDownloadWord = useCallback(async () => {
    if (!documentUrl) return;
    
    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      saveAs(blob, `${template?.name || 'contract-template'}.docx`);
    } catch (err) {
      alert('下载Word文档失败');
      console.error('下载Word文档失败:', err);
    }
  }, [documentUrl, template]);
  
  // 下载PDF文档
  const handleDownloadPdf = useCallback(async () => {
    if (!documentUrl || !templateId) return;
    
    try {
      // 这里需要实现PDF转换逻辑
      // 通常是调用后端API将Word转换为PDF
      alert('PDF转换功能正在开发中');
    } catch (err) {
      alert('下载PDF文档失败');
      console.error('下载PDF文档失败:', err);
    }
  }, [documentUrl, templateId]);
  
  // 生成合同
  const handleGenerateContract = useCallback(async () => {
    if (!templateId || !template) return;
    
    setIsGenerating(true);
    try {
      // 创建合同记录
      const generatedContract = await createGeneratedContract({
        template_id: templateId,
        template_version: template.versions[0].version,
        title: `${template.name} - 生成合同`,
        status: 'draft',
        variables_values: {}, // 空变量，用户可以在编辑后填充
        userId: userId
      });
      
      // 填充合同模板
      await runDocxFillAfterGeneratedContract({
        generatedId: generatedContract.id,
        templateFileVersionId: template.versions[0].id,
        variablesValues: {}, // 空变量
        userId: userId
      });
      
      setGeneratedContractId(generatedContract.id);
      alert('合同生成成功！');
      
      // 导航到合同详情页或预览
      navigate(`/contract/generated/${generatedContract.id}`);
    } catch (err) {
      alert('生成合同失败');
      console.error('生成合同失败:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [templateId, template, userId, navigate]);
  
  // 预览合同
  const handlePreviewContract = useCallback(async () => {
    if (!generatedContractId) {
      await handleGenerateContract();
      return;
    }
    
    // 导航到合同预览页
    navigate(`/contract/generated/${generatedContractId}/preview`);
  }, [generatedContractId, handleGenerateContract, navigate]);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="inline-block animate-spin h-16 w-16 border-4 border-blue-300 rounded-full border-t-blue-600"></span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button 
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={() => navigate('/contract/templates')}
          >
            <FaArrowLeft className="mr-2" />
            返回模板列表
          </button>
          <h1 className="text-2xl font-bold">{template?.name} - 在线编辑</h1>
        </div>
        
        <div className="flex space-x-2">
          <button 
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={handleDownloadWord}
          >
            <FaFileWord className="mr-2" />
            下载Word
          </button>
          <button 
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={handleDownloadPdf}
          >
            <FaFilePdf className="mr-2" />
            下载PDF
          </button>
          <button 
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSaveTemplate} 
            disabled={isSaving}
          >
            {isSaving ? <span className="inline-block animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></span> : <FaSave className="mr-2" />}
            保存模板
          </button>
          <button 
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleGenerateContract} 
            disabled={isGenerating}
          >
            {isGenerating ? <span className="inline-block animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></span> : <FaMagic className="mr-2" />}
            生成合同
          </button>
          <button 
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePreviewContract} 
            disabled={isGenerating}
          >
            <FaEye className="mr-2" />
            预览合同
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg p-4">
        {documentUrl && (
          <OnlyOfficeEditor
            documentUrl={documentUrl}
            documentTitle={template?.name || '合同模板'}
            documentKey={template?.versions?.[0]?.id}
            onlyOfficeCallbackQuery={
              template?.versions?.[0]?.id
                ? `template_file_version_id=${template.versions[0].id}`
                : undefined
            }
            height="700px"
            forceViewMode={false}
          />
        )}
      </div>
    </div>
  );
}

export default ContractTemplateEditorPage;