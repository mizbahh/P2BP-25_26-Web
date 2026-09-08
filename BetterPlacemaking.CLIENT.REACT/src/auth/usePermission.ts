import { useEffect, useReducer } from "react";
import * as permissionStore from "./permissionStore";
import type { PermissionMode } from "./permissionStore";

export interface UsePermissionOptions {
  projectId?: string;
  mode?: PermissionMode;
}

/** Reactive, cache-backed permission check for UI gating (not route guards - see RequirePermission). */
export function usePermission(permission: string | string[], options: UsePermissionOptions = {}): boolean {
  const { projectId, mode = "all" } = options;
  const [, forceRender] = useReducer((c: number) => c + 1, 0);

  useEffect(() => permissionStore.subscribe(forceRender), []);

  useEffect(() => {
    if (projectId) permissionStore.ensureProjectLoaded(projectId);
    else permissionStore.ensureGlobalLoaded();
  }, [projectId]);

  return projectId
    ? permissionStore.hasProjectCached(projectId, permission, mode)
    : permissionStore.hasGlobalCached(permission, mode);
}
