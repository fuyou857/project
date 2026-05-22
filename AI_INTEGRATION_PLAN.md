# 预警中心AI功能集成方案

## 1. 方案概述

本方案旨在为项目的预警中心集成免费的AI功能，并实现可随时访问的AI对话浮窗。方案将基于现有技术栈（React、Supabase、FastAPI等），确保与现有系统无缝集成，并满足数据安全、性能和用户体验要求。

## 2. 免费AI解决方案选型

### 2.1 语言模型对比

| 模型/服务 | 类型 | 优点 | 缺点 | 适用场景 |
|---------|------|------|------|----------|
| Gemini API | 云端API | 免费额度充足，性能强，支持多模态 | 有请求限制，数据可能离开本地 | 合同分析、自然语言交互 |
| Llama 3 (Ollama) | 本地部署 | 完全私有，无请求限制 | 硬件要求较高 | 数据敏感的财务查询 |
| Claude API | 云端API | 上下文窗口大，适合长文本 | 免费额度有限 | 合同分析 |
| Mistral | 本地部署 | 轻量级，性能好 | 模型规模较小 | 简单查询 |

### 2.2 推荐方案

**主方案：Gemini API + Ollama混合部署**
- 常规查询使用Gemini API（免费额度）
- 敏感数据查询使用本地部署的Llama 3（通过Ollama）
- 语音识别使用浏览器内置Web Speech API

## 3. 系统架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端层                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────┐ │
│  │   AI对话浮窗     │  │   合同编辑器插件   │  │  数据可视化  │ │
│  └────────┬────────┘  └────────┬────────┘  └────┬──────┘ │
│           │                    │                 │        │
└───────────┼────────────────────┼─────────────────┼────────┘
            │                    │                 │
┌───────────▼────────────────────▼─────────────────▼────────┐
│                      API网关层                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────┐ │
│  │   权限验证中间件  │  │   请求路由中间件   │  │  日志审计  │ │
│  └────────┬────────┘  └────────┬────────┘  └────┬──────┘ │
│           │                    │                 │        │
└───────────┼────────────────────┼─────────────────┼────────┘
            │                    │                 │
┌───────────▼────────┐  ┌────────▼────────┐  ┌─────▼────────┐
│    AI服务层        │  │  业务服务层     │  │  数据服务层   │
│  ┌─────────────┐   │  │  ┌─────────┐   │  │  ┌────────┐  │
│  │ Gemini API  │   │  │  │ 合同管理  │   │  │  │ Supabase│  │
│  └─────────────┘   │  │  └─────────┘   │  │  └────────┘  │
│  ┌─────────────┐   │  │  ┌─────────┐   │  │  ┌────────┐  │
│  │ Ollama (Llama3)│ │  │  │ 预警管理  │   │  │  │ 缓存服务 │  │
│  └─────────────┘   │  │  └─────────┘   │  │  └────────┘  │
└────────────────────┘  └────────────────┘  └───────────────┘
```

### 3.2 核心模块设计

#### 3.2.1 AI对话浮窗模块
- 实现悬浮式对话窗口，支持拖拽调整位置
- 集成文本和语音输入功能
- 实现对话历史记录和搜索功能
- 与项目UI风格保持一致的响应式设计

#### 3.2.2 数据访问与分析模块
- 实现与Supabase的安全连接
- 支持多维度数据查询和聚合分析
- 集成Recharts实现数据可视化
- 实现数据脱敏处理

#### 3.2.3 合同辅助模块
- 在Tiptap编辑器中集成AI分析插件
- 实现合同文本实时分析功能
- 提供合同瑕疵和风险点识别
- 支持合同模板推荐和条款补全

#### 3.2.4 权限控制模块
- 基于现有RBAC模型扩展AI访问权限
- 实现数据访问范围限制
- 集成Supabase RLS确保数据安全
- 实现数据访问审计日志

## 4. 技术实现步骤

### 4.1 环境准备（1天）

1. **设置Ollama服务**
   ```bash
   # 安装Ollama
   curl -fsSL https://ollama.com/install.sh | sh
   
   # 拉取Llama 3模型
   ollama pull llama3
   
   # 启动Ollama服务
   ollama serve
   ```

2. **获取Gemini API密钥**
   - 访问Google AI Studio获取免费API密钥
   - 配置环境变量`GEMINI_API_KEY`

3. **安装相关依赖**
   ```bash
   # 前端依赖
   npm install @google/generative-ai react-speech-recognition
   
   # 后端依赖（FastAPI）
   pip install google-generativeai ollama
   ```

### 4.2 后端AI服务开发（3天）

1. **创建FastAPI AI服务**
   ```python
   # ai_service/main.py
   from fastapi import FastAPI, Depends, HTTPException
   from fastapi.middleware.cors import CORSMiddleware
   from pydantic import BaseModel
   import google.generativeai as genai
   import ollama
   from supabase import create_client
   
   app = FastAPI()
   
   # 配置CORS
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["*"],  # 生产环境应限制为特定域名
       allow_credentials=True,
       allow_methods=["*"],
       allow_headers=["*"],
   )
   
   # 配置Gemini API
   genai.configure(api_key="GEMINI_API_KEY")
   
   # 配置Supabase
   supabase = create_client("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
   
   # 数据模型
   class AIQueryRequest(BaseModel):
       query: str
       user_id: str
       company_ids: list[str]
       is_sensitive: bool = False
   
   class ContractAnalysisRequest(BaseModel):
       contract_text: str
       contract_type: str
       user_id: str
   
   # API端点
   @app.post("/api/ai/query")
   async def ai_query(request: AIQueryRequest):
       # 权限验证逻辑
       # 数据访问范围限制
       # 选择AI模型
       if request.is_sensitive:
           # 使用本地Ollama模型
           response = ollama.chat(
               model="llama3",
               messages=[{"role": "user", "content": request.query}]
           )
           return {"response": response["message"]["content"]}
       else:
           # 使用Gemini API
           model = genai.GenerativeModel("gemini-pro")
           response = model.generate_content(request.query)
           return {"response": response.text}
   
   @app.post("/api/ai/analyze-contract")
   async def analyze_contract(request: ContractAnalysisRequest):
       # 合同分析逻辑
       model = genai.GenerativeModel("gemini-pro")
       prompt = f"分析以下{request.contract_type}合同，识别潜在的法律风险和条款不完善之处：\n\n{request.contract_text}"
       response = model.generate_content(prompt)
       return {"analysis": response.text}
   ```

2. **实现数据访问层**
   - 创建数据查询服务，支持多维度数据查询
   - 实现数据脱敏处理
   - 集成现有权限系统

### 4.3 前端AI浮窗开发（2天）

1. **创建AI浮窗组件**
   ```tsx
   // src/components/AIFloatWindow.tsx
   import React, { useState, useRef, useEffect } from 'react';
   import { motion, AnimatePresence } from 'framer-motion';
   import { FaRobot, FaTimes, FaMicrophone, FaMicrophoneSlash, FaSearch } from 'react-icons/fa';
   import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
   
   const AIFloatWindow: React.FC = () => {
     const [isOpen, setIsOpen] = useState(false);
     const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
     const [inputText, setInputText] = useState('');
     const [isRecording, setIsRecording] = useState(false);
     const [isLoading, setIsLoading] = useState(false);
     const { transcript, resetTranscript } = useSpeechRecognition();
     const windowRef = useRef<HTMLDivElement>(null);
     const [position, setPosition] = useState({ x: 80, y: 80 });
     const [isDragging, setIsDragging] = useState(false);
     const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
     
     // 拖拽逻辑
     const handleMouseDown = (e: React.MouseEvent) => {
       setIsDragging(true);
       setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
     };
     
     const handleMouseMove = (e: React.MouseEvent) => {
       if (isDragging) {
         setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
       }
     };
     
     const handleMouseUp = () => {
       setIsDragging(false);
     };
     
     useEffect(() => {
       if (isDragging) {
         document.addEventListener('mousemove', handleMouseMove);
         document.addEventListener('mouseup', handleMouseUp);
       }
       return () => {
         document.removeEventListener('mousemove', handleMouseMove);
         document.removeEventListener('mouseup', handleMouseUp);
       };
     }, [isDragging]);
     
     // 语音识别逻辑
     const toggleRecording = () => {
       if (isRecording) {
         SpeechRecognition.stopListening();
       } else {
         resetTranscript();
         SpeechRecognition.startListening({ continuous: true });
       }
       setIsRecording(!isRecording);
     };
     
     useEffect(() => {
       if (transcript) {
         setInputText(transcript);
       }
     }, [transcript]);
     
     // 发送消息逻辑
     const sendMessage = async () => {
       if (!inputText.trim()) return;
       
       const newMessage = { role: 'user' as const, content: inputText };
       setMessages(prev => [...prev, newMessage]);
       setInputText('');
       setIsLoading(true);
       
       try {
         const response = await fetch('/api/ai/query', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             query: inputText,
             user_id: 'current-user-id', // 从认证系统获取
             company_ids: ['company1', 'company2'], // 从权限系统获取
             is_sensitive: inputText.includes('财务') || inputText.includes('金额')
           })
         });
         
         const data = await response.json();
         const aiMessage = { role: 'ai' as const, content: data.response };
         setMessages(prev => [...prev, aiMessage]);
       } catch (error) {
         console.error('AI查询失败:', error);
         const errorMessage = { role: 'ai' as const, content: '抱歉，查询失败，请稍后重试' };
         setMessages(prev => [...prev, errorMessage]);
       } finally {
         setIsLoading(false);
       }
     };
     
     return (
       <>
         {/* 浮窗按钮 */}
         <motion.button
           className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
           onClick={() => setIsOpen(!isOpen)}
           whileHover={{ scale: 1.1 }}
           whileTap={{ scale: 0.95 }}
         >
           <FaRobot size={24} />
         </motion.button>
         
         {/* 对话窗口 */}
         <AnimatePresence>
           {isOpen && (
             <motion.div
               ref={windowRef}
               className="fixed bg-white rounded-lg shadow-2xl w-96 max-h-[70vh] flex flex-col"
               style={{ left: `${position.x}px`, top: `${position.y}px` }}
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.8 }}
             >
               {/* 窗口头部 */}
               <div 
                 className="bg-blue-600 text-white p-4 rounded-t-lg cursor-move flex justify-between items-center"
                 onMouseDown={handleMouseDown}
               >
                 <div className="flex items-center gap-2">
                   <FaRobot />
                   <span className="font-semibold">AI助手</span>
                 </div>
                 <button 
                   className="hover:bg-blue-700 p-1 rounded"
                   onClick={() => setIsOpen(false)}
                 >
                   <FaTimes />
                 </button>
               </div>
               
               {/* 对话内容 */}
               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                 {messages.map((message, index) => (
                   <div 
                     key={index} 
                     className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                   >
                     <div 
                       className={`max-w-[80%] p-3 rounded-lg ${message.role === 'user' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                     >
                       {message.content}
                     </div>
                   </div>
                 ))}
                 {isLoading && (
                   <div className="flex justify-start">
                     <div className="bg-gray-100 text-gray-800 p-3 rounded-lg">
                       <span className="animate-pulse">AI正在思考...</span>
                     </div>
                   </div>
                 )}
               </div>
               
               {/* 输入区域 */}
               <div className="p-4 border-t">
                 <div className="flex gap-2">
                   <button 
                     className={`p-2 rounded-full ${isRecording ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'} hover:opacity-80`}
                     onClick={toggleRecording}
                   >
                     {isRecording ? <FaMicrophoneSlash /> : <FaMicrophone />}
                   </button>
                   <input 
                     type="text"
                     className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                     placeholder="请输入您的问题..."
                     value={inputText}
                     onChange={(e) => setInputText(e.target.value)}
                     onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                   />
                   <button 
                     className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                     onClick={sendMessage}
                   >
                     <FaSearch />
                   </button>
                 </div>
               </div>
             </motion.div>
           )}
         </AnimatePresence>
       </>
     );
   };
   
   export default AIFloatWindow;
   ```

2. **集成到现有布局**
   ```tsx
   // src/components/Layout.tsx
   import AIFloatWindow from './AIFloatWindow';
   
   export default function Layout({ children }: { children: React.ReactNode }) {
     // 现有布局代码
     
     return (
       <div className="flex h-screen">
         {/* 现有组件 */}
         {children}
         
         {/* AI浮窗 */}
         <AIFloatWindow />
       </div>
     );
   }
   ```

### 4.4 合同辅助功能开发（2天）

1. **扩展Tiptap编辑器**
   ```tsx
   // src/components/contract/AIContractAnalyzer.tsx
   import React, { useState } from 'react';
   import { FaSearch, FaSpinner } from 'react-icons/fa';
   import { TiptapContractEditorHandle } from './TiptapContractEditor';
   
   type AIContractAnalyzerProps = {
     editorRef: React.RefObject<TiptapContractEditorHandle>;
     contractType: string;
   };
   
   const AIContractAnalyzer: React.FC<AIContractAnalyzerProps> = ({ editorRef, contractType }) => {
     const [isAnalyzing, setIsAnalyzing] = useState(false);
     const [analysisResult, setAnalysisResult] = useState<string | null>(null);
     
     const analyzeContract = async () => {
       if (!editorRef.current) return;
       
       const contractText = editorRef.current.getHTML();
       setIsAnalyzing(true);
       
       try {
         const response = await fetch('/api/ai/analyze-contract', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             contract_text: contractText,
             contract_type: contractType,
             user_id: 'current-user-id' // 从认证系统获取
           })
         });
         
         const data = await response.json();
         setAnalysisResult(data.analysis);
       } catch (error) {
         console.error('合同分析失败:', error);
         setAnalysisResult('抱歉，合同分析失败，请稍后重试');
       } finally {
         setIsAnalyzing(false);
       }
     };
     
     return (
       <div className="mt-4">
         <button
           className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
           onClick={analyzeContract}
           disabled={isAnalyzing}
         >
           {isAnalyzing ? <FaSpinner className="animate-spin" /> : <FaSearch />}
           AI合同分析
         </button>
         
         {analysisResult && (
           <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
             <h3 className="text-lg font-semibold mb-2 text-blue-600">分析结果</h3>
             <div className="whitespace-pre-wrap text-gray-700">{analysisResult}</div>
           </div>
         )}
       </div>
     );
   };
   
   export default AIContractAnalyzer;
   ```

2. **集成到合同编辑页面**
   ```tsx
   // src/pages/contract/ContractTemplateEditorPage.tsx
   import AIContractAnalyzer from '../../components/contract/AIContractAnalyzer';
   
   export default function ContractTemplateEditorPage() {
     const editorRef = useRef<TiptapContractEditorHandle>(null);
     
     // 现有代码
     
     return (
       <div>
         {/* 现有组件 */}
         <TiptapContractEditor 
           ref={editorRef}
           initialHtml={initialHtml}
           resetKey={resetKey}
         />
         
         {/* AI合同分析器 */}
         <AIContractAnalyzer 
           editorRef={editorRef} 
           contractType={contractType} 
         />
       </div>
     );
   }
   ```

### 4.5 数据安全与权限控制（1天）

1. **实现数据脱敏**
   ```python
   # ai_service/utils/data_masking.py
   def mask_sensitive_data(data: dict, sensitive_fields: list[str] = None) -> dict:
       if sensitive_fields is None:
           sensitive_fields = ['amount', 'price', 'salary', 'bank_account', 'id_card']
       
       masked_data = data.copy()
       for field, value in masked_data.items():
           if field in sensitive_fields and isinstance(value, (int, float)):
               # 只显示量级，隐藏具体数值
               masked_data[field] = f"{round(value / 10000)}万+"
           elif field in sensitive_fields and isinstance(value, str):
               # 隐藏部分字符
               if len(value) > 8:
                   masked_data[field] = value[:4] + '****' + value[-4:]
               else:
                   masked_data[field] = '****'
       
       return masked_data
   ```

2. **实现审计日志**
   ```python
   # ai_service/utils/audit_log.py
   async def log_ai_query(user_id: str, query: str, response: str, company_ids: list[str]):
       await supabase.from('ai_audit_logs').insert({
           'user_id': user_id,
           'query': query,
           'response': response,
           'company_ids': company_ids,
           'created_at': datetime.utcnow()
       })
   ```

### 4.6 性能优化与测试（2天）

1. **实现缓存机制**
   ```python
   # ai_service/utils/cache.py
   from cachetools import TTLCache
   
   # 创建TTL缓存，有效期1小时，最多1000条
   cache = TTLCache(maxsize=1000, ttl=3600)
   
   def get_cached_response(query: str, company_ids: list[str]) -> str | None:
       key = f"{query}_{'_'.join(company_ids)}"
       return cache.get(key)
   
   def set_cached_response(query: str, company_ids: list[str], response: str) -> None:
       key = f"{query}_{'_'.join(company_ids)}"
       cache[key] = response
   ```

2. **性能测试**
   - 使用JMeter或Locust进行负载测试
   - 测试不同查询类型的响应时间
   - 优化查询性能，确保满足响应时间要求

### 4.7 部署与上线（1天）

1. **部署AI服务**
   ```bash
   # 构建Docker镜像
   docker build -t ai-service .
   
   # 运行容器
   docker run -d -p 8000:8000 --env-file .env ai-service
   ```

2. **配置Nginx反向代理**
   ```nginx
   location /api/ai/ {
       proxy_pass http://localhost:8000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   }
   ```

3. **更新前端构建**
   ```bash
   npm run build:low-mem
   bash scripts/deploy-site.sh
   ```

## 5. 数据安全策略

### 5.1 数据访问控制
- 基于现有RBAC模型，为AI功能添加专门的权限
- 实现数据访问范围限制，确保用户只能访问其权限范围内的数据
- 集成Supabase RLS，在数据库层面确保数据安全

### 5.2 数据脱敏
- 对敏感字段（如金额、银行账户、身份证号等）进行脱敏处理
- 实现动态脱敏策略，根据用户权限决定脱敏程度

### 5.3 审计日志
- 记录所有AI数据查询操作
- 包括用户ID、查询内容、响应内容、访问时间等信息
- 定期审计日志，发现异常访问

### 5.4 安全传输
- 使用HTTPS加密传输所有数据
- 实现API密钥认证，防止未授权访问

## 6. 测试计划

### 6.1 单元测试
- 测试AI服务的各个API端点
- 测试数据脱敏和权限控制功能
- 测试缓存机制

### 6.2 集成测试
- 测试前端与后端的集成
- 测试AI功能与现有系统的集成
- 测试数据流向的完整性

### 6.3 性能测试
- 测试常规查询的响应时间（要求<3秒）
- 测试复杂分析的响应时间（要求<10秒）
- 测试系统在高并发下的性能

### 6.4 安全测试
- 测试权限控制的有效性
- 测试数据脱敏的完整性
- 测试API的安全性

## 7. 部署与维护方案

### 7.1 部署架构
- 使用Docker容器化部署AI服务
- 配置自动伸缩，应对高并发
- 实现负载均衡，提高系统可用性

### 7.2 监控与告警
- 监控AI服务的运行状态
- 监控API的响应时间和错误率
- 实现告警机制，及时发现问题

### 7.3 维护计划
- 定期更新AI模型
- 定期优化系统性能
- 定期检查安全漏洞
- 提供技术支持和问题排查

## 8. 开发周期预估

| 阶段 | 时间 | 主要工作 |
|------|------|----------|
| 环境准备 | 1天 | 安装Ollama、配置API密钥、安装依赖 |
| 后端AI服务开发 | 3天 | 实现AI查询API、合同分析API、数据访问层 |
| 前端AI浮窗开发 | 2天 | 实现悬浮式对话窗口、语音输入、对话历史 |
| 合同辅助功能开发 | 2天 | 扩展Tiptap编辑器、实现合同分析功能 |
| 数据安全与权限控制 | 1天 | 实现数据脱敏、审计日志、权限控制 |
| 性能优化与测试 | 2天 | 实现缓存、性能测试、安全测试 |
| 部署与上线 | 1天 | 部署AI服务、配置Nginx、更新前端 |
| 总计 | 12天 | |

## 9. 成本估算

| 项目 | 成本 | 说明 |
|------|------|------|
| AI服务 | 免费 | 使用Gemini API免费额度和Ollama本地部署 |
| 云服务器 | 已有 | 基于现有云服务器资源 |
| 开发人力 | 内部 | 使用现有开发团队 |
| 总计 | 免费 | 完全基于免费资源和现有基础设施 |

## 10. 风险评估与应对措施

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| API请求限制 | 影响用户体验 | 实现本地缓存，减少API请求次数 |
| 本地模型性能 | 影响响应时间 | 优化模型配置，使用轻量级模型 |
| 数据安全 | 泄露敏感信息 | 严格实现数据脱敏和权限控制 |
| 系统集成 | 影响现有功能 | 进行充分测试，确保与现有系统兼容 |

## 11. 后续扩展建议

1. **扩展AI功能**：
   - 添加更多数据分析功能
   - 实现预测性分析
   - 支持更多自然语言处理任务

2. **优化用户体验**：
   - 添加更多交互方式
   - 优化界面设计
   - 提供个性化推荐

3. **增强系统性能**：
   - 优化模型推理速度
   - 实现更高效的缓存机制
   - 扩展系统容量

4. **提高系统安全性**：
   - 定期更新安全策略
   - 加强安全审计
   - 实现更严格的权限控制

---

本方案基于现有技术栈和免费资源，实现了预警中心的AI功能集成。方案满足了用户的所有要求，包括数据访问与分析能力、合同辅助功能、交互界面要求、数据安全与权限控制要求以及响应性能要求。通过本方案的实施，将显著提升系统的智能化水平和用户体验。