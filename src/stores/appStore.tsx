import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase/client';

export interface Company {
  id: string;
  name: string;
  company_type: string;
  parent_id: string | null;
}

interface User {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  company_id?: string;
}

interface Theme {
  mode: 'light' | 'dark';
}

interface AppState {
  currentCompany: Company | null;
  companies: Company[];
  user: User | null;
  theme: Theme;
  initialized: boolean;
}

interface AppContextType extends AppState {
  setCurrentCompany: (company: Company) => void;
  setTheme: (theme: Theme) => void;
  isSuperAdmin: () => boolean;
  getCompanyIds: () => string[];
  refreshCompanies: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  currentCompany: null,
  companies: [],
  user: null,
  theme: { mode: 'dark' },
  initialized: false,
  setCurrentCompany: (_company: Company) => undefined,
  setTheme: (_theme: Theme) => undefined,
  isSuperAdmin: () => false,
  getCompanyIds: () => [],
  refreshCompanies: async () => undefined,
});

export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<Theme>({ mode: 'dark' });
  const [initialized, setInitialized] = useState(false);
  const initRef = useRef(false);

  const fetchCompanies = useCallback(async (userCompanyId?: string) => {
    const { data } = await supabase.from('companies').select('*').order('created_at');
    if (data) {
      localStorage.setItem('companies', JSON.stringify(data));
      setCompanies(data);

      if (userCompanyId) {
        const userCompany = data.find(c => c.id === userCompanyId);
        if (userCompany) {
          setCurrentCompany(userCompany);
          localStorage.setItem('currentCompanyId', userCompany.id);
          setInitialized(true);
          return;
        }
      }

      const savedId = localStorage.getItem('currentCompanyId');
      if (savedId) {
        const company = data.find(c => c.id === savedId);
        if (company) {
          setCurrentCompany(company);
          setInitialized(true);
          return;
        }
      }

      const parentCompanies = data.filter(c => c.company_type === '总公司' || c.parent_id === '0');
      if (parentCompanies.length > 0) {
        setCurrentCompany(parentCompanies[0]);
        localStorage.setItem('currentCompanyId', parentCompanies[0].id);
      }
      setInitialized(true);
    }
  }, []);

  const checkUser = useCallback(async () => {
    const cachedUser = localStorage.getItem('user');
    
    if (cachedUser) {
      try {
        const parsedUser = JSON.parse(cachedUser);
        setUser({
          id: parsedUser.id,
          email: parsedUser.email,
          company_id: parsedUser.company_id
        });
      } catch (e) {
        localStorage.removeItem('user');
      }
    }

    const savedCompanyId = localStorage.getItem('currentCompanyId');
    const cachedCompanies = localStorage.getItem('companies');
    
    if (cachedCompanies && savedCompanyId) {
      try {
        const parsedCompanies = JSON.parse(cachedCompanies);
        setCompanies(parsedCompanies);
        const savedCompany = parsedCompanies.find((c: Company) => c.id === savedCompanyId);
        if (savedCompany) {
          setCurrentCompany(savedCompany);
          setInitialized(true);
        }
      } catch (e) {
        localStorage.removeItem('companies');
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const userData = session.user as User;
      const { data: dbUser } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', session.user.id)
        .maybeSingle();
      
      const userWithCompany = {
        ...userData,
        company_id: dbUser?.company_id
      };
      setUser(userWithCompany);
      
      if (dbUser?.company_id) {
        await fetchCompanies(dbUser.company_id);
      } else {
        await fetchCompanies();
      }
    } else {
      setUser(null);
      await fetchCompanies();
    }
  }, [fetchCompanies]);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        checkUser();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [checkUser]);

  function handleSetCurrentCompany(company: Company) {
    if (currentCompany?.id === company.id) return;
    localStorage.setItem('currentCompanyId', company.id);
    setCurrentCompany(company);
    window.location.reload();
  }

  function isSuperAdmin() {
    try {
      const s = localStorage.getItem('user');
      if (!s) return false;
      const u = JSON.parse(s) as { is_super_admin?: boolean };
      return Boolean(u.is_super_admin);
    } catch {
      return false;
    }
  }

  function getCompanyIds() {
    if (!currentCompany) return [];
    const ids = [currentCompany.id];
    const children = companies.filter(c => c.parent_id === currentCompany.id || c.parent_id === '0');
    children.forEach(c => ids.push(c.id));
    return ids;
  }

  async function refreshCompanies() {
    await checkUser();
  }

  return (
    <AppContext.Provider
      value={{
        currentCompany,
        companies,
        user,
        theme,
        initialized,
        setCurrentCompany: handleSetCurrentCompany,
        setTheme,
        isSuperAdmin,
        getCompanyIds,
        refreshCompanies,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}