import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../config/firebase.js";
import { Permissions } from "./permissions.js";

interface SeedEntry {
  collection: "role_definitions_global" | "role_definitions_project";
  roleName: string;
  permissions: string[];
}

const SEED_ROLES: SeedEntry[] = [
  { collection: "role_definitions_global", roleName: "SuperAdmin", permissions: [...Permissions.Global.All, ...Permissions.Project.All] },
  { collection: "role_definitions_global", roleName: "Admin", permissions: [...Permissions.Global.All, ...Permissions.Project.All] },
  { collection: "role_definitions_project", roleName: "ProjectAdmin", permissions: Permissions.Project.Admin },
  { collection: "role_definitions_project", roleName: "ProjectOwner", permissions: Permissions.Project.Admin },
  { collection: "role_definitions_project", roleName: "ProjectViewer", permissions: Permissions.Project.Viewer },
  { collection: "role_definitions_project", roleName: "ProjectEditor", permissions: Permissions.Project.Editor },
];

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    seen.set(value.toLowerCase(), value);
  }
  return Array.from(seen.values());
}

/**
 * Idempotently upserts the system role definitions on startup. If an admin has
 * hand-edited a role doc and explicitly set isSystem: false, that doc is left
 * alone - this only ever protects/refreshes docs that are still system-owned.
 */
export async function seedRoles(): Promise<void> {
  const db = getDb();

  for (const entry of SEED_ROLES) {
    const ref = db.collection(entry.collection).doc(entry.roleName);
    const existing = await ref.get();

    if (existing.exists && existing.data()?.isSystem === false) {
      continue;
    }

    await ref.set(
      {
        permissions: dedupeCaseInsensitive(entry.permissions),
        isSystem: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}
