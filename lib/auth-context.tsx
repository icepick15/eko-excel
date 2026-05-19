'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from './types';
import { auth } from './storage';
import { seedData, seedExtended } from './seed';

interface AuthContextValue {
  user: User | null;
  login: (phone: string) => { success: boolean; error?: string };
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    seedData();
    seedExtended();
    const current = auth.current();
    setUser(current);
    setIsLoading(false);
  }, []);

  function login(phone: string): { success: boolean; error?: string } {
    const found = auth.login(phone);
    if (!found) return { success: false, error: 'Phone number not found. Try: 08012345678' };
    auth.setCurrentUser(found);
    setUser(found);
    return { success: true };
  }

  function logout() {
    auth.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
