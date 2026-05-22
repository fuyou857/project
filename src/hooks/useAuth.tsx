/**
 * 认证相关的自定义 Hook
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../supabase/client';
import { getUserById, isStrictSuperAdmin, isSuperAdmin, type User } from '../services/userService';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  isStrictSuperAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  isStrictSuperAdmin: boolean;
  canEditUser: (targetUser: User) => boolean;
  canDeleteUser: (targetUser: User) => boolean;
  canResetPassword: (targetUser: User) => boolean;
  canModifyRoles: () => boolean;
  refreshUser: () => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getInitialAuthState = (): AuthState => {
  const cachedUser = localStorage.getItem('user');
  
  if (cachedUser) {
    try {
      const parsedUser = JSON.parse(cachedUser);
      return {
        user: parsedUser,
        loading: false,
        error: null,
        isSuperAdmin: parsedUser.is_super_admin || false,
        isStrictSuperAdmin: parsedUser.is_strict_super_admin || false,
      };
    } catch (e) {
      localStorage.removeItem('user');
    }
  }
  
  return {
    user: null,
    loading: true,
    error: null,
    isSuperAdmin: false,
    isStrictSuperAdmin: false,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(getInitialAuthState);

  const fetchCurrentUser = useCallback(async () => {
    const cachedUser = localStorage.getItem('user');
    
    if (cachedUser) {
      try {
        const parsedUser = JSON.parse(cachedUser);
        setAuthState({
          user: parsedUser,
          loading: false,
          error: null,
          isSuperAdmin: parsedUser.is_super_admin || false,
          isStrictSuperAdmin: parsedUser.is_strict_super_admin || false,
        });
      } catch (e) {
        localStorage.removeItem('user');
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const dbUser = await getUserById(user.id);
        if (dbUser) {
          const adminStatus = await isSuperAdmin(dbUser);
          const strictAdminStatus = await isStrictSuperAdmin(dbUser);
          const userWithAdmin = {
            ...dbUser,
            is_super_admin: adminStatus,
            is_strict_super_admin: strictAdminStatus,
          };
          localStorage.setItem('user', JSON.stringify(userWithAdmin));
          setAuthState({
            user: userWithAdmin,
            loading: false,
            error: null,
            isSuperAdmin: adminStatus,
            isStrictSuperAdmin: strictAdminStatus,
          });
        } else {
          localStorage.removeItem('user');
          setAuthState({
            user: null,
            loading: false,
            error: '用户信息未找到',
            isSuperAdmin: false,
            isStrictSuperAdmin: false,
          });
        }
      } else {
        localStorage.removeItem('user');
        setAuthState({
          user: null,
          loading: false,
          error: null,
          isSuperAdmin: false,
          isStrictSuperAdmin: false,
        });
      }
    } catch (error: unknown) {
      if (!cachedUser) {
        setAuthState({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : '获取用户信息失败',
          isSuperAdmin: false,
          isStrictSuperAdmin: false,
        });
      }
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        void fetchCurrentUser();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [fetchCurrentUser]);

  const canEditUser = useCallback((targetUser: User): boolean => {
    if (!authState.user) return false;

    if (authState.isSuperAdmin) return true;

    return authState.user.id === targetUser.id;
  }, [authState.user, authState.isSuperAdmin]);

  const canDeleteUser = useCallback((targetUser: User): boolean => {
    if (!authState.user) return false;

    if (!authState.isSuperAdmin) return false;

    if (authState.user.id === targetUser.id) return false;

    return true;
  }, [authState.user, authState.isSuperAdmin]);

  const canResetPassword = useCallback((targetUser: User): boolean => {
    if (!authState.user) return false;

    if (authState.isSuperAdmin) return true;

    return authState.user.id === targetUser.id;
  }, [authState.user, authState.isSuperAdmin]);

  const canModifyRoles = useCallback((): boolean => {
    if (!authState.user) return false;
    return authState.isSuperAdmin;
  }, [authState.user, authState.isSuperAdmin]);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { error: new Error(error.message) };
      }
      await fetchCurrentUser();
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }, [fetchCurrentUser]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
    setAuthState({
      user: null,
      loading: false,
      error: null,
      isSuperAdmin: false,
      isStrictSuperAdmin: false,
    });
  }, []);

  const value: AuthContextType = {
    ...authState,
    canEditUser,
    canDeleteUser,
    canResetPassword,
    canModifyRoles,
    refreshUser: fetchCurrentUser,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}