import type { ReactNode } from "react";
import { usePermission, type UsePermissionOptions } from "./usePermission";

interface HasPermissionProps extends UsePermissionOptions {
  permission: string | string[];
  children: ReactNode;
}

/** Replaces the Angular *hasPermission structural directive. */
export function HasPermission({ permission, children, ...options }: HasPermissionProps) {
  const allowed = usePermission(permission, options);
  return allowed ? <>{children}</> : null;
}
