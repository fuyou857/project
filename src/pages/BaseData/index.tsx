import { useLocation, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import PartyAList from './PartyAList';
import PartyBList from './PartyBList';
import SignatoryList from './SignatoryList';
import ProjectMgmtStaffList from './ProjectMgmtStaffList';

type TabType = 'party-a' | 'signatory' | 'party-b' | 'project-mgmt-staff';

const BASE_DATA_TABS: { pathSuffix: string; tab: TabType; label: string }[] = [
  { pathSuffix: '/base-data/party-a', tab: 'party-a', label: '甲方单位' },
  { pathSuffix: '/base-data/signatory', tab: 'signatory', label: '签约单位' },
  { pathSuffix: '/base-data/party-b', tab: 'party-b', label: '乙方单位' },
  { pathSuffix: '/base-data/project-mgmt-staff', tab: 'project-mgmt-staff', label: '项目部管理人员' },
];

function getActiveTabFromPath(pathname: string): TabType {
  if (pathname.includes('/project-mgmt-staff')) return 'project-mgmt-staff';
  if (pathname.includes('/signatory')) return 'signatory';
  if (pathname.includes('/party-b')) return 'party-b';
  return 'party-a';
}

export default function BaseData() {
  const location = useLocation();
  const activeTab = getActiveTabFromPath(location.pathname);

  const tabLabels: Record<TabType, string> = {
    'party-a': '甲方单位',
    signatory: '签约单位',
    'party-b': '乙方单位',
    'project-mgmt-staff': '项目部管理人员',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-800">基础数据管理 - {tabLabels[activeTab]}</h2>
      </div>

      {/* 页内 Tab：不依赖侧栏即可切换到「项目部管理人员」等子模块 */}
      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-3" aria-label="基础数据子模块">
        {BASE_DATA_TABS.map(({ pathSuffix, label }) => (
          <NavLink
            key={pathSuffix}
            to={pathSuffix}
            className={({ isActive }) =>
              `rounded-lg px-4 py-2 text-sm font-medium transition-colors min-h-[44px] inline-flex items-center ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'party-a' && <PartyAList />}
          {activeTab === 'signatory' && <SignatoryList />}
          {activeTab === 'party-b' && <PartyBList />}
          {activeTab === 'project-mgmt-staff' && <ProjectMgmtStaffList />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
