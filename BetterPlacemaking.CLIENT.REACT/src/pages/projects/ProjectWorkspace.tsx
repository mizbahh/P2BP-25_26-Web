import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { HasPermission } from "../../auth/HasPermission";
import { Permissions } from "../../lib/permissions";
import * as projectApi from "../../services/projectApi";
import type { ProjectDto } from "../../lib/projectTypes";

/** Project-workspace shell - title + nav to every project-scoped page. */
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

      <nav className="mt-4 flex flex-wrap gap-4 border-b border-neutral-200 text-sm">
        <Link to={`/${projectId}/dashboard`} className="border-b-2 border-transparent pb-2 hover:border-indigo-500">
          Dashboard
        </Link>
        <HasPermission permission={Permissions.Project.ScansRead} projectId={projectId}>
          <Link to={`/${projectId}/model`} className="border-b-2 border-transparent pb-2 hover:border-indigo-500">
            3D Model
          </Link>
        </HasPermission>
        <HasPermission permission={Permissions.Project.VisionRead} projectId={projectId}>
          <Link to={`/${projectId}/vision`} className="border-b-2 border-transparent pb-2 hover:border-indigo-500">
            Vision
          </Link>
        </HasPermission>
        <HasPermission permission={Permissions.Project.ScansRead} projectId={projectId}>
          <Link to={`/${projectId}/fusion`} className="border-b-2 border-transparent pb-2 hover:border-indigo-500">
            Fusion
          </Link>
        </HasPermission>
        <HasPermission permission={Permissions.Project.DevicesRead} projectId={projectId}>
          <Link to={`/${projectId}/devices`} className="border-b-2 border-transparent pb-2 hover:border-indigo-500">
            Devices
          </Link>
        </HasPermission>
        <HasPermission permission={Permissions.Project.MembersAssignEditorViewer} projectId={projectId}>
          <Link
            to={`/${projectId}/admin/permissions`}
            className="border-b-2 border-transparent pb-2 hover:border-indigo-500"
          >
            Permissions
          </Link>
        </HasPermission>
        <HasPermission permission={Permissions.Global.UsersRead}>
          <Link to={`/${projectId}/admin/users`} className="border-b-2 border-transparent pb-2 hover:border-indigo-500">
            Users
          </Link>
        </HasPermission>
        <HasPermission permission={Permissions.Global.ProjectsReadAll}>
          <Link
            to={`/${projectId}/admin/projects`}
            className="border-b-2 border-transparent pb-2 hover:border-indigo-500"
          >
            Manage Projects
          </Link>
        </HasPermission>
      </nav>

      <div className="mt-6">
        <Outlet context={{ project }} />
      </div>
    </div>
  );
}
