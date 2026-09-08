import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { sanitizeReturnUrl } from "./sanitizeReturnUrl";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return null;

  if (!isAuthenticated) {
    const returnUrl = sanitizeReturnUrl(location.pathname + location.search);
    const search = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : "";
    return <Navigate to={`/login${search}`} replace />;
  }

  return <>{children}</>;
}
