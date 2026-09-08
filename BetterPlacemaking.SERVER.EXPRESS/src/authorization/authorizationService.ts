import NodeCache from "node-cache";
import { getDb } from "../config/firebase.js";

// Global-permission checks are cached for 10 minutes (matches the ASP.NET server's
// IDistributedCache TTL). Project-permission checks are intentionally never cached -
// project membership changes more often and the original server always reads it fresh.
const globalPermissionCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

function hasPermissionCaseInsensitive(permissions: string[] | undefined, permission: string): boolean {
  if (!permissions || permissions.length === 0) return false;
  const target = permission.toLowerCase();
  return permissions.some((p) => p.toLowerCase() === target);
}

async function roleGrantsPermission(
  collection: "role_definitions_global" | "role_definitions_project",
  roleNames: string[],
  permission: string,
): Promise<boolean> {
  if (roleNames.length === 0) return false;
  const db = getDb();
  const docs = await Promise.all(
    roleNames.map((role) => db.collection(collection).doc(role).get()),
  );
  return docs.some((doc) => {
    if (!doc.exists) return false;
    const permissions = doc.data()?.permissions as string[] | undefined;
    return hasPermissionCaseInsensitive(permissions, permission);
  });
}

async function getUserGlobalRoles(userId: string): Promise<string[]> {
  const db = getDb();
  const doc = await db.collection("user_global_roles").doc(userId).get();
  if (!doc.exists) return [];
  return (doc.data()?.roles as string[] | undefined) ?? [];
}

async function getUserProjectRoles(userId: string, projectId: string): Promise<string[]> {
  const db = getDb();
  const doc = await db.collection("projects").doc(projectId).collection("members").doc(userId).get();
  if (!doc.exists) return [];
  return (doc.data()?.roles as string[] | undefined) ?? [];
}

function candidateGlobalRoles(userId: string, jwtRole: string | undefined, assignedRoles: string[]): string[] {
  // The legacy single `role` JWT claim is folded into the global role set, matching
  // HasGlobalPermissionFreshAsync (an "Admin" role claim is itself a role-definition lookup key).
  const roles = new Set(assignedRoles);
  if (jwtRole) roles.add(jwtRole);
  return Array.from(roles);
}

export async function hasGlobalPermissionFresh(
  userId: string,
  jwtRole: string | undefined,
  permission: string,
): Promise<boolean> {
  const assignedRoles = await getUserGlobalRoles(userId);
  const roles = candidateGlobalRoles(userId, jwtRole, assignedRoles);
  return roleGrantsPermission("role_definitions_global", roles, permission);
}

export async function hasGlobalPermission(
  userId: string,
  jwtRole: string | undefined,
  permission: string,
): Promise<boolean> {
  const cacheKey = `authz:global:user:${userId}:permission:${permission}`;
  const cached = globalPermissionCache.get<boolean>(cacheKey);
  if (cached !== undefined) return cached;

  const allowed = await hasGlobalPermissionFresh(userId, jwtRole, permission);
  globalPermissionCache.set(cacheKey, allowed);
  return allowed;
}

export async function hasProjectPermission(
  userId: string,
  jwtRole: string | undefined,
  projectId: string,
  permission: string,
): Promise<boolean> {
  const assignedGlobalRoles = await getUserGlobalRoles(userId);
  const globalRoles = candidateGlobalRoles(userId, jwtRole, assignedGlobalRoles);
  if (await roleGrantsPermission("role_definitions_global", globalRoles, permission)) {
    return true;
  }

  const projectRoles = await getUserProjectRoles(userId, projectId);
  if (projectRoles.length === 0) return false;
  return roleGrantsPermission("role_definitions_project", projectRoles, permission);
}

/** Test-only escape hatch; production code never needs to clear this. */
export function _clearGlobalPermissionCache(): void {
  globalPermissionCache.flushAll();
}

async function unionPermissions(
  collection: "role_definitions_global" | "role_definitions_project",
  roleNames: string[],
): Promise<string[]> {
  if (roleNames.length === 0) return [];
  const db = getDb();
  const docs = await Promise.all(roleNames.map((role) => db.collection(collection).doc(role).get()));
  const seen = new Map<string, string>();
  for (const doc of docs) {
    if (!doc.exists) continue;
    const permissions = (doc.data()?.permissions as string[] | undefined) ?? [];
    for (const p of permissions) seen.set(p.toLowerCase(), p);
  }
  return Array.from(seen.values());
}

/**
 * Effective permissions for the `/api/user/me/permissions*` display endpoints.
 * Unlike hasGlobalPermission/hasProjectPermission (used by the requirePermission
 * middleware), this intentionally does NOT fold in the JWT's legacy `role` claim -
 * that matches UserService.GetEffectiveGlobalPermissions/GetEffectiveProjectPermissions
 * in the ASP.NET server exactly (two independent implementations that behave
 * slightly differently, preserved as-is rather than merged).
 */
export async function getEffectiveGlobalPermissions(userId: string): Promise<string[]> {
  const roles = await getUserGlobalRoles(userId);
  return unionPermissions("role_definitions_global", roles);
}

export async function getEffectiveProjectPermissions(userId: string, projectId: string): Promise<string[]> {
  const globalPermissions = await getEffectiveGlobalPermissions(userId);
  const projectRoles = await getUserProjectRoles(userId, projectId);
  const projectPermissions = await unionPermissions("role_definitions_project", projectRoles);

  const seen = new Map<string, string>();
  for (const p of [...globalPermissions, ...projectPermissions]) seen.set(p.toLowerCase(), p);
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

export async function getProjectRoleOptions(): Promise<string[]> {
  const db = getDb();
  const snapshot = await db.collection("role_definitions_project").get();
  return snapshot.docs.map((doc) => doc.id).sort((a, b) => a.localeCompare(b));
}

export { getUserGlobalRoles, getUserProjectRoles };
