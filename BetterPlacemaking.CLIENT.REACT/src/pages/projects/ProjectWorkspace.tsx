import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { HasPermission } from "../../auth/HasPermission";
import { Permissions } from "../../lib/permissions";
import * as projectApi from "../../services/projectApi";
import type { ProjectDto } from "../../lib/projectTypes";

/**
 * Minimal project-workspace shell - title + nav to Devices/Admin. Later phases
 * (Dashboard, Vision, Fusion) slot their routes in here alongside Devices.
 */
export function ProjectWorkspace() {
  const { projectId } = useParams();
  const [project, setProject] = useState<ProjectDto | null>(null);

  useEffect(() => {
    if (!projectId) return;
    projectApi.getProject(projectId).then(setProject);
  }, [projectId]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Link to="/projects" className="text-sm text-indigo-600 hover:underline">
            ← All projects
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-neutral-900">{project?.Title ?? "…"}</h1>
        </div>
      </div>

      <nav className="mt-4 flex gap-4 border-b border-neutral-200 text-sm">
        <HasPermission permission={Permissions.Project.DevicesRead} projectId={projectId}>
          <Link to={`/${projectId}/devices`} className="border-b-2 border-transparent pb-2 hover:border-indigo-500">
            Devices
          </Link>
        </HasPermission>
        <HasPermission permission={Permissions.Global.ProjectsReadAll}>
          <Link
            to={`/${projectId}/admin/projects`}
            className="border-b-2 border-transparent pb-2 hover:border-indigo-500"
          >
            Admin
          </Link>
        </HasPermission>
      </nav>

      <div className="mt-6">
        <Outlet context={{ project }} />
      </div>
    </div>
  );
}
