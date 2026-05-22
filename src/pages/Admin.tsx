import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import UserManagement from './admin/UserManagement';
import RoleManagement from './admin/RoleManagement';
import OperationLogs from './admin/OperationLogs';
import BackupSettings from './admin/BackupSettings';
import CompanyManagement from './admin/CompanyManagement';
import ApiKeyCenter from './admin/ApiKeyCenter';
import ApprovalWorkflowSettings from './admin/ApprovalWorkflowSettings';

type TabType = 'users' | 'roles' | 'logs' | 'backup' | 'companies' | 'keys' | 'approval';

function getActiveFromPath(pathname: string): TabType {
  if (pathname === '/admin' || pathname === '/admin/') return 'users';
  if (pathname.includes('/roles')) return 'roles';
  if (pathname.includes('/logs')) return 'logs';
  if (pathname.includes('/backup')) return 'backup';
  if (pathname.includes('/companies')) return 'companies';
  if (pathname.includes('/keys')) return 'keys';
  if (pathname.includes('/approval-workflow')) return 'approval';
  return 'users';
}



export default function Admin() {
  const location = useLocation();
  const activeTab = getActiveFromPath(location.pathname);

  const renderContent = () => {
    switch (activeTab) {
      case 'users': return <UserManagement />;
      case 'roles': return <RoleManagement />;
      case 'logs': return <OperationLogs />;
      case 'backup': return <BackupSettings />;
      case 'companies': return <CompanyManagement />;
      case 'keys': return <ApiKeyCenter />;
      case 'approval': return <ApprovalWorkflowSettings />;
      default: return <UserManagement />;
    }
  };

  return (
    <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-full"
      >
        {renderContent()}
      </motion.div>
  );
}
