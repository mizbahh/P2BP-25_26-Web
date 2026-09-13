import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as projectApi from "../../services/projectApi";
import type { ProjectDto } from "../../lib/projectTypes";

/**
 * Landing page for any authenticated user - unpermissioned route, server-side
 * filtered response (GET /api/project returns "my projects" for a non-admin,
 * "every project" for someone with Global.Projects.ReadAll). No Add/Edit/Delete
 * here, matching the Angular SelectProject component.
 */
export function SelectProject() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectApi
      .getProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-neutral-900">Your Projects</h1>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-600">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">No projects assigned.</p>
      ) : (
        <table className="mt-4 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm">
          <thead className="bg-neutral-100 text-left text-neutral-700">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.Id} className="border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-900">{project.Title}</td>
                <td className="px-4 py-2 text-neutral-600">{project.Description}</td>
                <td className="px-4 py-2 text-neutral-600">{project.Location}</td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/${project.Id}`} className="text-indigo-600 hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
