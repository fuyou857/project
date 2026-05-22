import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaFileAlt, FaCheckCircle } from 'react-icons/fa';
import OutputReport from './labor/OutputReport';
import OutputAudit from './labor/OutputAudit';

const menuItems = [
  { key: 'report', label: '产值上报', icon: FaFileAlt, path: '/labor/report' },
  { key: 'audit', label: '产值审核', icon: FaCheckCircle, path: '/labor/audit' },
];

export default function Labor() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMenu, setActiveMenu] = useState('report');

  useEffect(() => {
    const path = location.pathname;
    const active = menuItems.find(item => path === item.path || path.startsWith(item.path + '/'));
    if (active) {
      setActiveMenu(active.key);
    } else {
      navigate('/labor/report', { replace: true });
    }
  }, [location.pathname, navigate]);

  const renderContent = () => {
    switch (activeMenu) {
      case 'report': return <OutputReport />;
      case 'audit': return <OutputAudit />;
      default: return <OutputReport />;
    }
  };

  return (
    <motion.div
      key={activeMenu}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full"
    >
      {renderContent()}
    </motion.div>
  );
}
