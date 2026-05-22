import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaBox, FaSignInAlt } from 'react-icons/fa';
import MaterialList from './materials/MaterialList';
import MaterialInbound from './materials/MaterialInbound';

const menuItems = [
  { key: 'list', label: '物资清单', icon: FaBox, path: '/materials/list' },
  { key: 'inbound', label: '物资入库', icon: FaSignInAlt, path: '/materials/inbound' },
];

export default function Materials() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeMenu, setActiveMenu] = useState('list');

  useEffect(() => {
    const path = location.pathname;
    const active = menuItems.find(item => path === item.path || path.startsWith(item.path + '/'));
    if (active) {
      setActiveMenu(active.key);
    } else {
      navigate('/materials/list', { replace: true });
    }
  }, [location.pathname, navigate]);

  const renderContent = () => {
    switch (activeMenu) {
      case 'list': return <MaterialList />;
      case 'inbound': return <MaterialInbound />;
      default: return <MaterialList />;
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
