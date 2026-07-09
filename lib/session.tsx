'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api, setAccessToken, tryRefresh } from './api';
import type { SessionUser } from './types';

/**
 * Session context. On mount it bootstraps the session by attempting a silent
 * refresh (using the httpOnly cookie) and, if that succeeds, loading /auth/me.
 * The access token itself never leaves memory in `api.ts`.
 *
 * NOTE: `role` here is used ONLY to decide what UI to render. The server still
 * authorizes every request — a user who tampers with this value gains nothing.
 */
interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; orgName: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const { user } = await api<{ user: SessionUser }>('/auth/me');
    setUser(user);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ok = await tryRefresh();
        if (ok) await loadMe();
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string, mfaCode?: string) => {
      const res = await api<{ user: SessionUser; accessToken: string }>('/auth/login', {
        method: 'POST',
        body: { email, password, ...(mfaCode ? { mfaCode } : {}) },
      });
      setAccessToken(res.accessToken);
      setUser(res.user);
    },
    [],
  );

  const register = useCallback(
    async (input: { email: string; password: string; name: string; orgName: string }) => {
      const res = await api<{ user: SessionUser; accessToken: string }>('/auth/register', {
        method: 'POST',
        body: input,
      });
      setAccessToken(res.accessToken);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <SessionContext.Provider value={{ user, loading, login, register, logout, refreshUser: loadMe }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
