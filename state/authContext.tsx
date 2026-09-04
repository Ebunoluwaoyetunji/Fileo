/**
 * Auth/session state shared across the whole app.
 *
 * This is a lightweight in-memory placeholder — wire it up to real
 * persistence (SecureStore) and a backend/API once those exist.
 */
import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  isLoading: boolean;
  signIn: (user: AuthUser) => void;
  signOut: () => void;
  completeOnboarding: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading] = useState(false);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      hasCompletedOnboarding,
      isLoading,
      signIn: (nextUser) => setUser(nextUser),
      signOut: () => setUser(null),
      completeOnboarding: () => setHasCompletedOnboarding(true),
    }),
    [user, hasCompletedOnboarding, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
