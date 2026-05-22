import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './hooks/useAuth';
import { AppProvider } from './stores';
import { routes } from './config/routes';

/** 旧书签 / 缓存 hash：#/contract-templates → 新路径（HashRouter 下 pathname 为 /contract-templates） */
function LegacyContractTemplateHashRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const p = location.pathname;
    if (p === '/contract-templates' || p.startsWith('/contract-templates/')) {
      const tail = p.slice('/contract-templates'.length);
      navigate(`/contract/templates${tail === '' ? '' : tail}`, { replace: true });
    }
  }, [location.pathname, navigate]);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <HashRouter>
          <LegacyContractTemplateHashRedirect />
          <Routes>
            {routes.map(route => (
              <Route
                key={route.path}
                path={route.path}
                element={route.element}
              />
            ))}
          </Routes>
        </HashRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
