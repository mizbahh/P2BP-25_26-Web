import { api } from "./apiClient";
import * as authStore from "./authStore";

export type PermissionMode = "all" | "any";
type PermissionSet = Set<string>;

let globalPermissions: PermissionSet | null = null;
let globalLoading: Promise<PermissionSet> | null = null;
const projectPermissions = new Map<string, PermissionSet>();
const projectLoading = new Map<string, Promise<PermissionSet>>();
const listeners = new Set<() => void>();
let lastUserId: string | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function reset(): void {
  globalPermissions = null;
  globalLoading = null;
  projectPermissions.clear();
  projectLoading.clear();
  notify();
}

// Mirrors PermissionService subscribing to AuthService.state$: wipe every cached
// permission set whenever the logged-in user changes (login/logout/user switch).
authStore.subscribe((state) => {
  const userId = state?.User.Id ?? null;
  if (userId !== lastUserId) {
    lastUserId = userId;
    reset();
  }
});

function toLowerSet(values: string[]): PermissionSet {
  return new Set(values.map((v) => v.toLowerCase()));
}

function evaluate(set: PermissionSet | undefined, permission: string | string[], mode: PermissionMode): boolean {
  const perms = Array.isArray(permission) ? permission : [permission];
  if (perms.length === 0) return true;
  if (!set) return false;
  const check = (p: string) => set.has(p.toLowerCase());
  return mode === "any" ? perms.some(check) : perms.every(check);
}

function loadGlobal(): Promise<PermissionSet> {
  if (globalPermissions) return Promise.resolve(globalPermissions);
  if (!globalLoading) {
    globalLoading = api.get<string[]>("/api/user/me/permissions").then((perms) => {
      globalPermissions = toLowerSet(perms);
      notify();
      return globalPermissions;
    });
  }
  return globalLoading;
}

function loadProject(projectId: string): Promise<PermissionSet> {
  const cached = projectPermissions.get(projectId);
  if (cached) return Promise.resolve(cached);

  let loading = projectLoading.get(projectId);
  if (!loading) {
    loading = api.get<string[]>(`/api/user/me/permissions/${projectId}`).then((perms) => {
      const set = toLowerSet(perms);
      projectPermissions.set(projectId, set);
      notify();
      return set;
    });
    projectLoading.set(projectId, loading);
  }
  return loading;
}

export function ensureGlobalLoaded(): void {
  void loadGlobal();
}

export function ensureProjectLoaded(projectId: string): void {
  void loadProject(projectId);
}

export function hasGlobalCached(permission: string | string[], mode: PermissionMode = "all"): boolean {
  return evaluate(globalPermissions ?? undefined, permission, mode);
}

export function hasProjectCached(projectId: string, permission: string | string[], mode: PermissionMode = "all"): boolean {
  return evaluate(projectPermissions.get(projectId), permission, mode);
}

/** Always hits the API and refreshes the cache - used by route guards, not UI gating. */
export async function hasGlobalFresh(permission: string | string[], mode: PermissionMode = "all"): Promise<boolean> {
  globalPermissions = null;
  globalLoading = null;
  const set = await loadGlobal();
  return evaluate(set, permission, mode);
}

export async function hasProjectFresh(
  projectId: string,
  permission: string | string[],
  mode: PermissionMode = "all",
): Promise<boolean> {
  projectPermissions.delete(projectId);
  projectLoading.delete(projectId);
  const set = await loadProject(projectId);
  return evaluate(set, permission, mode);
}
