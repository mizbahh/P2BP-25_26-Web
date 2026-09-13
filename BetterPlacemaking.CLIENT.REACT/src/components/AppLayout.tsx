import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { HasPermission } from "../auth/HasPermission";
import { Permissions } from "../lib/permissions";
import { RequireAuth } from "../routes/RequireAuth";

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/projects" className="font-semibold text-neutral-900">
                BetterPlacemaking
              </Link>
              <HasPermission permission={Permissions.Global.ProjectsReadAll}>
                <Link to="/admin/projects" className="text-neutral-600 hover:text-neutral-900">
                  Admin
                </Link>
              </HasPermission>
            </nav>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-neutral-600">{user?.FirstName ?? user?.Email}</span>
              <button
                onClick={() => void logout()}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-neutral-700 hover:bg-neutral-100"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">
          <Outlet />
        </main>
      </div>
    </RequireAuth>
  );
}
