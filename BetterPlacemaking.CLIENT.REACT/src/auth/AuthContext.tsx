import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import * as authStore from "./authStore";
import type { AuthResponse, AuthUser } from "../lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<{ Success: boolean; Message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(authStore.subscribe, authStore.getState, authStore.getState);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    authStore.init().finally(() => setInitializing(false));
  }, []);

  const value: AuthContextValue = {
    user: state?.User ?? null,
    isAuthenticated: authStore.isAuthenticated(),
    initializing,
    login: authStore.login,
    register: authStore.register,
    logout: authStore.logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
