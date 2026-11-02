import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from './api';
import { tokenStore } from './storage';
import type { User } from './types';

const TOKEN_KEY = 'sanqoba.token';

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await tokenStore.get(TOKEN_KEY);
      if (token) {
        setAuthToken(token);
        try {
          setUser((await api.me()).user);
        } catch {
          setAuthToken(null);
          await tokenStore.set(TOKEN_KEY, null);
        }
      }
      setReady(true);
    })();
  }, []);

  const startSession = useCallback(async ({ token, user }: { token: string; user: User }) => {
    setAuthToken(token);
    await tokenStore.set(TOKEN_KEY, token);
    setUser(user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      login: async (u, p) => startSession(await api.login(u, p)),
      register: async (u, p) => startSession(await api.register(u, p)),
      logout: async () => {
        setAuthToken(null);
        await tokenStore.set(TOKEN_KEY, null);
        setUser(null);
      },
    }),
    [user, ready, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
