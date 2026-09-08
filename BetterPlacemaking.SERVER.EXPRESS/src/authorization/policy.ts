export type PermissionScope = "Global" | "Project";

export interface ParsedPermission {
  scope: PermissionScope;
  permission: string;
}

/** Mirrors PermissionPolicyName.TryParse - scope is inferred from the "Global."/"Project." prefix. */
export function parsePermission(permission: string): ParsedPermission | null {
  if (!permission) return null;
  const lower = permission.toLowerCase();
  if (lower.startsWith("global.")) return { scope: "Global", permission };
  if (lower.startsWith("project.")) return { scope: "Project", permission };
  return null;
}
