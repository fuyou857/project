import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import EquipmentList from './equipment/EquipmentList';
import EquipmentReport from './equipment/EquipmentReport';

export default function Machines() {
  const location = useLocation();

  const activeComponent = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/equipment/report')) {
      return <EquipmentReport />;
    }
    return <EquipmentList />;
  }, [location.pathname]);

  return <div className="h-full">{activeComponent}</div>;
}
