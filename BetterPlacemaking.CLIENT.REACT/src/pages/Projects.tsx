import { useAuth } from "../auth/AuthContext";
import { HasPermission } from "../auth/HasPermission";
import { Permissions } from "../lib/permissions";

/**
 * Placeholder authenticated landing page - proves the Phase 1 auth stack end to
 * end (JWT, permission checks, logout). Projects/Devices themselves are a later
 * migration phase.
 */
export function Projects() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-neutral-900">
            Welcome, {user?.FirstName ?? user?.Email}
          </h1>
          <button
            onClick={() => void logout()}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Log out
          </button>
        </div>

        <p className="mt-4 text-sm text-neutral-600">
          This is a Phase 1 placeholder - Projects/Devices management is migrated in a later phase.
        </p>

        <HasPermission permission={Permissions.Global.ProjectsCreate}>
          <p className="mt-4 rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">
            You have permission to create projects (Global.Projects.Create).
          </p>
        </HasPermission>
      </div>
    </div>
  );
}
