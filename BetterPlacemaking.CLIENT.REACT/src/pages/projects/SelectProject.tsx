import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../../components/prime";
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

  useEffect(() => {
    projectApi
      .getProjects()
      .then((p) => setProjects(p ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="w-full flex flex-col content-background rounded-lg">
      <DataTable
        value={projects}
        className="rounded-lg overflow-hidden"
        caption={
          <div className="w-full flex justify-between items-center">
            <div className="gap-3">
              <span className="font-semibold text-xl">Projects</span>
            </div>
          </div>
        }
        headerTemplate={() => (
          <tr>
            <th>Title</th>
            <th>Description</th>
            <th>Location</th>
            <th>Action</th>
          </tr>
        )}
        bodyTemplate={(project: ProjectDto) => (
          <tr>
            <td>{project.Title}</td>
            <td>{project.Description}</td>
            <td>{project.Location}</td>
            <td>
              <Link to={`/${project.Id}`} className="p-button p-component p-button-sm p-button-outlined">
                Open
              </Link>
            </td>
          </tr>
        )}
        emptyMessage={
          <tr>
            <td colSpan={4}>No projects assigned.</td>
          </tr>
        }
      />
    </div>
  );
}
