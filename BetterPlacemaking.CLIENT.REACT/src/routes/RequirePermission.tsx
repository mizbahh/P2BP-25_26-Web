import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import * as permissionStore from "../auth/permissionStore";
import type { PermissionMode } from "../auth/permissionStore";

interface RequirePermissionProps {
  permission: string | string[];
  mode?: PermissionMode;
  scope?: "global" | "project";
  children: ReactNode;
}

/** Mirrors permissionGuard: always checks fresh (not the cached UI-gating value), redirects to /projects on denial. */
export function RequirePermission({ permission, mode = "all", scope = "project", children }: RequirePermissionProps) {
  const { projectId } = useParams();
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    const check =
      scope === "global"
        ? permissionStore.hasGlobalFresh(permission, mode)
        : permissionStore.hasProjectFresh(projectId ?? "", permission, mode);

    check
      .then((allowed) => {
        if (!cancelled) setState(allowed ? "allowed" : "denied");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(permission) ? permission.join(",") : permission, mode, scope, projectId]);

  if (state === "loading") return null;
  if (state === "denied") return <Navigate to="/projects" replace />;
  return <>{children}</>;
}
