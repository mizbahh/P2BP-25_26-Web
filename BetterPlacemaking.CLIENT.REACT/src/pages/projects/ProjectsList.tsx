import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { HasPermission } from "../../auth/HasPermission";
import { Permissions } from "../../lib/permissions";
import * as projectApi from "../../services/projectApi";
import type { ProjectDto } from "../../lib/projectTypes";
import { ProjectForm } from "./ProjectForm";

/** Admin "all/manageable projects" console - reused at both /admin/projects and /:projectId/admin/projects. */
export function ProjectsList() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProjectDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<ProjectDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    projectApi
      .getProjects()
      .then(setProjects)
      .catch(() => setError("Failed to load projects"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSave(input: Parameters<typeof projectApi.addProject>[0]) {
    try {
      if (editing && editing !== "new") {
        await projectApi.updateProject(editing.Id, input);
      } else {
        await projectApi.addProject(input);
      }
      setEditing(null);
      load();
    } catch {
      setError("Failed to save project");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await projectApi.deleteProject(deleting.Id);
      setDeleting(null);
      load();
    } catch {
      setError("Failed to delete project");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Projects ({projects.length})</h1>
        <HasPermission permission={Permissions.Global.ProjectsCreate}>
          <button
            onClick={() => setEditing("new")}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Add Project
          </button>
        </HasPermission>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-neutral-600">Loading…</p>
      ) : (
        <table className="mt-4 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm">
          <thead className="bg-neutral-100 text-left text-neutral-700">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.Id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-900">{project.Title}</td>
                <td className="px-4 py-2 text-neutral-600">{project.Description}</td>
                <td className="px-4 py-2 text-neutral-600">{project.Location}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-3">
                    <HasPermission permission={Permissions.Project.Update} projectId={project.Id}>
                      <button onClick={() => setEditing(project)} className="text-indigo-600 hover:underline">
                        Edit
                      </button>
                    </HasPermission>
                    <HasPermission permission={Permissions.Project.Delete} projectId={project.Id}>
                      <button onClick={() => setDeleting(project)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </HasPermission>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <ProjectForm
          project={editing === "new" ? undefined : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete Project"
          message={`Delete project "${deleting.Title || deleting.Id}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
