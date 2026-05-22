import { useMemo } from 'react';
import { useCompany } from '../components/Layout';
import { collectCompanyIds } from '../utils/companyScope';

/** 当前公司及子公司 id 范围（替代各页重复的 getCompanyIds） */
export function useCompanyScope() {
  const { currentCompany, companies } = useCompany();
  const companyIds = useMemo(
    () => collectCompanyIds(currentCompany, companies),
    [currentCompany, companies],
  );
  return { currentCompany, companies, companyIds };
}
