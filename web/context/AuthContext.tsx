'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, getToken, setToken } from '@/lib/client';

interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string, admin?: boolean) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const data = await api.getMe();
      setUser(data.user ?? data);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string, admin = false) => {
    const data = admin ? await api.adminLogin({ email, password }) : await api.login({ email, password });
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => { setToken(null); setUser(null); }, []);

  return (
    <Ctx.Provider value={{ user, isLoggedIn: !!user, isAdmin: user?.role === 'ADMIN', loading, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
