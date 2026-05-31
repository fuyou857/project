import React, { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { DISABLE_FRONTEND_AUTH } from './accessControl';
import Layout from '../components/Layout';
import ProtectedRoute from '../components/ProtectedRoute';

const PublishedTasksPage = lazy(() => import('../pages/tasks/PublishedTasksPage'));
const TodoTasksPage = lazy(() => import('../pages/tasks/TodoTasksPage'));
const InvolvedTasksPage = lazy(() => import('../pages/tasks/InvolvedTasksPage'));
const TaskStatsPage = lazy(() => import('../pages/tasks/TaskStatsPage'));
const MessagesPage = lazy(() => import('../pages/tasks/MessagesPage'));
const ApprovalCenter = lazy(() => import('../pages/approval/ApprovalCenter'));
const TaskDetailPage = lazy(() => import('../pages/tasks/TaskDetailPage'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Projects = lazy(() => import('../pages/Projects'));
const ProjectDetail = lazy(() => import('../pages/ProjectDetail'));
const ProjectSupplier = lazy(() => import('../pages/ProjectSupplier'));
const Finance = lazy(() => import('../pages/Finance'));
const Materials = lazy(() => import('../pages/Materials'));
const Machines = lazy(() => import('../pages/Machines'));
const MachineShift = lazy(() => import('../pages/machineShift/MachineShift'));
const MachineManagement = lazy(() => import('../pages/machine/MachineManagement'));
const MaterialManagement = lazy(() => import('../pages/material/MaterialManagement'));
const PurchaseOrderManagement = lazy(() => import('../pages/purchaseOrder/PurchaseOrderManagement'));
const InboundManagement = lazy(() => import('../pages/inbound/InboundManagement'));
const FixedAssetManagement = lazy(() => import('../pages/fixedAsset/FixedAssetManagement'));
const IssueManagement = lazy(() => import('../pages/issue/IssueManagement'));
const MobileScanPage = lazy(() => import('../pages/mobile/MobileScanPage'));
const MobileMachineShift = lazy(() => import('../pages/mobile/MobileMachineShift'));
const Labor = lazy(() => import('../pages/Labor'));
const SealManagement = lazy(() => import('../pages/SealManagement'));
const Admin = lazy(() => import('../pages/Admin'));
const Workers = lazy(() => import('../pages/Workers'));
const Warnings = lazy(() => import('../pages/Warnings'));
const BaseData = lazy(() => import('../pages/BaseData/index'));
const IncomeContractList = lazy(() => import('../pages/contract/IncomeContractList'));
const ExpenseContractList = lazy(() => import('../pages/contract/ExpenseContractList'));
const IncomeSupplement = lazy(() => import('../pages/contract/IncomeSupplement'));
const ExpenseSupplement = lazy(() => import('../pages/contract/ExpenseSupplement'));
const IncomeVariation = lazy(() => import('../pages/contract/IncomeVariation'));
const ExpenseVariation = lazy(() => import('../pages/contract/ExpenseVariation'));
const IncomeDeduction = lazy(() => import('../pages/contract/IncomeDeduction'));
const ExpenseDeduction = lazy(() => import('../pages/contract/ExpenseDeduction'));
const IncomeOutput = lazy(() => import('../pages/contract/IncomeOutput'));
const IncomeSettlement = lazy(() => import('../pages/contract/IncomeSettlement'));
const ExpensePerformance = lazy(() => import('../pages/contract/ExpensePerformance'));
const ExpenseSettlement = lazy(() => import('../pages/contract/ExpenseSettlement'));
const ContractReminderCenter = lazy(() => import('../pages/contract/ContractReminderCenter'));
const ContractReminderSettings = lazy(() => import('../pages/contract/ContractReminderSettings'));
const ContractTemplateLibraryPage = lazy(() => import('../pages/contract/ContractTemplateLibraryPage'));
const ContractTemplateEditorPage = lazy(() => import('../pages/contract/ContractTemplateEditorPage'));
const GeneratedContractDraftEditorPage = lazy(
  () => import('../pages/contract/GeneratedContractDraftEditorPage'),
);
const TaxDebtList = lazy(() => import('../pages/finance/TaxDebtList'));
const ReceiptRegistration = lazy(() => import('../pages/finance/ReceiptRegistration'));
const OtherIncome = lazy(() => import('../pages/finance/OtherIncome'));
const InvoiceEntry = lazy(() => import('../pages/finance/InvoiceEntry'));
const CostInvoiceList = lazy(() => import('../pages/finance/CostInvoiceList'));
const PaymentRegistration = lazy(() => import('../pages/finance/PaymentRegistration'));
const UninvoicedPayments = lazy(() => import('../pages/finance/UninvoicedPayments'));
const Login = lazy(() => import('../pages/Login'));
const TestOnlyOffice = lazy(() => import('../pages/TestOnlyOffice'));

type RouteElement = React.ReactElement | null;

interface RouteConfig {
  path: string;
  element: RouteElement;
  exact?: boolean;
}

/** 路由 chunk 加载时占位（已在 Layout 内，勿用整页骨架以免重复顶栏侧栏） */
function RouteChunkFallback() {
  return (
    <div
      className="flex min-h-[28rem] flex-col items-center justify-center gap-3 text-sm text-gray-500"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
        aria-hidden
      />
      <span>页面加载中…</span>
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteChunkFallback />}>{children}</Suspense>;
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

const routes: RouteConfig[] = [
  { path: '/login', element: <LazyPage><Login /></LazyPage> },
  // ONLYOFFICE测试页面 - 公开访问
  { path: '/test-onlyoffice', element: <LazyPage><TestOnlyOffice /></LazyPage> },
  {
    path: '/',
    element: (
      <Navigate to={DISABLE_FRONTEND_AUTH ? '/dashboard' : '/login'} replace />
    ),
  },

  { path: '/dashboard', element: <ProtectedLayout><LazyPage><Dashboard /></LazyPage></ProtectedLayout> },

  { path: '/projects', element: <ProtectedLayout><LazyPage><Projects /></LazyPage></ProtectedLayout> },
  { path: '/projects/new', element: <ProtectedLayout><LazyPage><Projects /></LazyPage></ProtectedLayout> },
  { path: '/projects/:id', element: <ProtectedLayout><LazyPage><ProjectDetail /></LazyPage></ProtectedLayout> },
  { path: '/project/supplier/:projectId', element: <ProtectedLayout><LazyPage><ProjectSupplier /></LazyPage></ProtectedLayout> },

  { path: '/tasks/published', element: <ProtectedLayout><LazyPage><PublishedTasksPage /></LazyPage></ProtectedLayout> },
  { path: '/tasks/todo', element: <ProtectedLayout><LazyPage><TodoTasksPage /></LazyPage></ProtectedLayout> },
  { path: '/tasks/involved', element: <ProtectedLayout><LazyPage><InvolvedTasksPage /></LazyPage></ProtectedLayout> },
  { path: '/tasks/stats', element: <ProtectedLayout><LazyPage><TaskStatsPage /></LazyPage></ProtectedLayout> },
  { path: '/messages', element: <ProtectedLayout><LazyPage><MessagesPage /></LazyPage></ProtectedLayout> },
  { path: '/approval', element: <ProtectedLayout><LazyPage><ApprovalCenter /></LazyPage></ProtectedLayout> },
  { path: '/tasks/:taskId', element: <ProtectedLayout><LazyPage><TaskDetailPage /></LazyPage></ProtectedLayout> },
  { path: '/tasks', element: <ProtectedLayout><Navigate to="/tasks/published" replace /></ProtectedLayout> },

  {
    path: '/contract-templates',
    element: (
      <ProtectedLayout>
        <Navigate to="/contract/templates" replace />
      </ProtectedLayout>
    ),
  },
  { path: '/contract/templates/edit/:templateId', element: <ProtectedLayout><LazyPage><ContractTemplateLibraryPage /></LazyPage></ProtectedLayout> },
  { path: '/contract/templates/generation', element: <ProtectedLayout><LazyPage><ContractTemplateLibraryPage /></LazyPage></ProtectedLayout> },
  { path: '/contract/templates/my-generated/trash', element: <ProtectedLayout><LazyPage><ContractTemplateLibraryPage /></LazyPage></ProtectedLayout> },
  { path: '/contract/templates/my-generated', element: <ProtectedLayout><LazyPage><ContractTemplateLibraryPage /></LazyPage></ProtectedLayout> },
  { path: '/contract/templates/draft/:contractId/edit', element: <ProtectedLayout><LazyPage><GeneratedContractDraftEditorPage /></LazyPage></ProtectedLayout> },
  /** 仅用于管理员在线改「系统模板」原文件；勿与「用当前模板新建合同」混用 */
  { path: '/contract/templates/editor/:templateId', element: <ProtectedLayout><LazyPage><ContractTemplateEditorPage /></LazyPage></ProtectedLayout> },
  { path: '/contract/templates', element: <ProtectedLayout><LazyPage><ContractTemplateLibraryPage /></LazyPage></ProtectedLayout> },

  { path: '/finance', element: <ProtectedLayout><LazyPage><Finance /></LazyPage></ProtectedLayout> },
  { path: '/finance/invoice', element: <ProtectedLayout><LazyPage><Finance /></LazyPage></ProtectedLayout> },
  { path: '/finance/invoice-issue', element: <ProtectedLayout><LazyPage><Finance /></LazyPage></ProtectedLayout> },
  { path: '/finance/tax-debt', element: <ProtectedLayout><LazyPage><TaxDebtList /></LazyPage></ProtectedLayout> },
  { path: '/finance/invoice-list', element: <ProtectedLayout><LazyPage><Finance /></LazyPage></ProtectedLayout> },
  { path: '/finance/receipt', element: <ProtectedLayout><LazyPage><ReceiptRegistration /></LazyPage></ProtectedLayout> },
  { path: '/finance/payment', element: <ProtectedLayout><LazyPage><PaymentRegistration /></LazyPage></ProtectedLayout> },
  { path: '/finance/payment/pending', element: <ProtectedLayout><LazyPage><PaymentRegistration /></LazyPage></ProtectedLayout> },
  { path: '/finance/payment/paid', element: <ProtectedLayout><LazyPage><PaymentRegistration /></LazyPage></ProtectedLayout> },
  { path: '/finance/unpaid', element: <ProtectedLayout><LazyPage><Finance /></LazyPage></ProtectedLayout> },
  { path: '/finance/uninvoiced', element: <ProtectedLayout><LazyPage><UninvoicedPayments /></LazyPage></ProtectedLayout> },
  { path: '/finance/other-income', element: <ProtectedLayout><LazyPage><OtherIncome /></LazyPage></ProtectedLayout> },
  { path: '/finance/cost-invoice', element: <ProtectedLayout><LazyPage><InvoiceEntry /></LazyPage></ProtectedLayout> },
  { path: '/finance/cost-invoice-list', element: <ProtectedLayout><LazyPage><CostInvoiceList /></LazyPage></ProtectedLayout> },

  { path: '/materials/list', element: <ProtectedLayout><LazyPage><Materials /></LazyPage></ProtectedLayout> },
  { path: '/materials/inbound', element: <ProtectedLayout><LazyPage><Materials /></LazyPage></ProtectedLayout> },
  { path: '/materials', element: <ProtectedLayout><LazyPage><Materials /></LazyPage></ProtectedLayout> },

  { path: '/machines/list', element: <ProtectedLayout><LazyPage><Machines /></LazyPage></ProtectedLayout> },
  { path: '/machines/report', element: <ProtectedLayout><LazyPage><Machines /></LazyPage></ProtectedLayout> },
  { path: '/machines', element: <ProtectedLayout><LazyPage><Machines /></LazyPage></ProtectedLayout> },

  { path: '/machine-shift', element: <ProtectedLayout><LazyPage><MachineShift /></LazyPage></ProtectedLayout> },
  { path: '/machine-management', element: <ProtectedLayout><LazyPage><MachineManagement /></LazyPage></ProtectedLayout> },
  { path: '/material', element: <ProtectedLayout><LazyPage><MaterialManagement /></LazyPage></ProtectedLayout> },
  { path: '/purchase-order', element: <ProtectedLayout><LazyPage><PurchaseOrderManagement /></LazyPage></ProtectedLayout> },
  { path: '/inbound', element: <ProtectedLayout><LazyPage><InboundManagement /></LazyPage></ProtectedLayout> },
  { path: '/fixed-asset', element: <ProtectedLayout><LazyPage><FixedAssetManagement /></LazyPage></ProtectedLayout> },
  { path: '/issue', element: <ProtectedLayout><LazyPage><IssueManagement /></LazyPage></ProtectedLayout> },
  { path: '/mobile/scan', element: <LazyPage><MobileScanPage /></LazyPage> },
  { path: '/mobile/machine-shift', element: <LazyPage><MobileMachineShift /></LazyPage> },

  { path: '/labor/report', element: <ProtectedLayout><LazyPage><Labor /></LazyPage></ProtectedLayout> },
  { path: '/labor/audit', element: <ProtectedLayout><LazyPage><Labor /></LazyPage></ProtectedLayout> },
  { path: '/labor', element: <ProtectedLayout><LazyPage><Labor /></LazyPage></ProtectedLayout> },

  { path: '/seals', element: <ProtectedLayout><LazyPage><SealManagement /></LazyPage></ProtectedLayout> },
  { path: '/seals/apply', element: <ProtectedLayout><LazyPage><SealManagement /></LazyPage></ProtectedLayout> },
  { path: '/seals/project', element: <ProtectedLayout><LazyPage><SealManagement /></LazyPage></ProtectedLayout> },
  { path: '/seals/borrow', element: <ProtectedLayout><LazyPage><SealManagement /></LazyPage></ProtectedLayout> },
  { path: '/seals/history', element: <ProtectedLayout><LazyPage><SealManagement /></LazyPage></ProtectedLayout> },

  { path: '/admin', element: <ProtectedLayout><LazyPage><Admin /></LazyPage></ProtectedLayout> },
  { path: '/admin/users', element: <ProtectedLayout><LazyPage><Admin /></LazyPage></ProtectedLayout> },
  { path: '/admin/roles', element: <ProtectedLayout><LazyPage><Admin /></LazyPage></ProtectedLayout> },
  { path: '/admin/logs', element: <ProtectedLayout><LazyPage><Admin /></LazyPage></ProtectedLayout> },
  { path: '/admin/backup', element: <ProtectedLayout><LazyPage><Admin /></LazyPage></ProtectedLayout> },
  { path: '/admin/companies', element: <ProtectedLayout><LazyPage><Admin /></LazyPage></ProtectedLayout> },
  { path: '/admin/keys', element: <ProtectedLayout><LazyPage><Admin /></LazyPage></ProtectedLayout> },
  { path: '/admin/approval-workflow', element: <ProtectedLayout><LazyPage><Admin /></LazyPage></ProtectedLayout> },

  { path: '/workers', element: <ProtectedLayout><LazyPage><Workers /></LazyPage></ProtectedLayout> },
  { path: '/workers/attendance', element: <ProtectedLayout><LazyPage><Workers /></LazyPage></ProtectedLayout> },
  { path: '/workers/payment', element: <ProtectedLayout><LazyPage><Workers /></LazyPage></ProtectedLayout> },
  { path: '/workers/contract', element: <ProtectedLayout><LazyPage><Workers /></LazyPage></ProtectedLayout> },

  { path: '/warnings', element: <ProtectedLayout><LazyPage><Warnings /></LazyPage></ProtectedLayout> },
  { path: '/warnings/config', element: <ProtectedLayout><LazyPage><Warnings /></LazyPage></ProtectedLayout> },

  { path: '/base-data/party-a', element: <ProtectedLayout><LazyPage><BaseData /></LazyPage></ProtectedLayout> },
  { path: '/base-data/signatory', element: <ProtectedLayout><LazyPage><BaseData /></LazyPage></ProtectedLayout> },
  { path: '/base-data/party-b', element: <ProtectedLayout><LazyPage><BaseData /></LazyPage></ProtectedLayout> },
  { path: '/base-data/project-mgmt-staff', element: <ProtectedLayout><LazyPage><BaseData /></LazyPage></ProtectedLayout> },
  { path: '/base-data', element: <ProtectedLayout><Navigate to="/base-data/party-a" replace /></ProtectedLayout> },

  { path: '/contract/income/list', element: <ProtectedLayout><LazyPage><IncomeContractList /></LazyPage></ProtectedLayout> },
  { path: '/contract/income/supplement', element: <ProtectedLayout><LazyPage><IncomeSupplement /></LazyPage></ProtectedLayout> },
  { path: '/contract/income/variation', element: <ProtectedLayout><LazyPage><IncomeVariation /></LazyPage></ProtectedLayout> },
  { path: '/contract/income/deduction', element: <ProtectedLayout><LazyPage><IncomeDeduction /></LazyPage></ProtectedLayout> },
  { path: '/contract/income/output', element: <ProtectedLayout><LazyPage><IncomeOutput /></LazyPage></ProtectedLayout> },
  { path: '/contract/income/settlement', element: <ProtectedLayout><LazyPage><IncomeSettlement /></LazyPage></ProtectedLayout> },
  { path: '/contract/expense/list', element: <ProtectedLayout><LazyPage><ExpenseContractList /></LazyPage></ProtectedLayout> },
  { path: '/contract/expense/supplement', element: <ProtectedLayout><LazyPage><ExpenseSupplement /></LazyPage></ProtectedLayout> },
  { path: '/contract/expense/variation', element: <ProtectedLayout><LazyPage><ExpenseVariation /></LazyPage></ProtectedLayout> },
  { path: '/contract/expense/deduction', element: <ProtectedLayout><LazyPage><ExpenseDeduction /></LazyPage></ProtectedLayout> },
  { path: '/contract/expense/performance', element: <ProtectedLayout><LazyPage><ExpensePerformance /></LazyPage></ProtectedLayout> },
  { path: '/contract/expense/settlement', element: <ProtectedLayout><LazyPage><ExpenseSettlement /></LazyPage></ProtectedLayout> },
  { path: '/contract/reminders', element: <ProtectedLayout><LazyPage><ContractReminderCenter /></LazyPage></ProtectedLayout> },
  { path: '/contract/reminders/settings', element: <ProtectedLayout><LazyPage><ContractReminderSettings /></LazyPage></ProtectedLayout> },
  /** 须置于 /contract/templates 等子路径之后，避免吞掉子路由 */
  { path: '/contract', element: <ProtectedLayout><LazyPage><IncomeContractList /></LazyPage></ProtectedLayout> },
  

];

export { routes };
export type { RouteConfig };
