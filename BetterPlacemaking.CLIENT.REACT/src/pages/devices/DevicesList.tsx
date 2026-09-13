import { useEffect, useState } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { HasPermission } from "../../auth/HasPermission";
import { Permissions } from "../../lib/permissions";
import * as deviceApi from "../../services/deviceApi";
import * as projectApi from "../../services/projectApi";
import type { DeviceDto } from "../../lib/deviceTypes";
import type { ProjectDto } from "../../lib/projectTypes";
import { DeviceForm } from "./DeviceForm";
import { DeviceHealthReport } from "./DeviceHealthReport";
import { DeviceApiInfo } from "./DeviceApiInfo";

function formatLastHeartbeat(timestamp: number | undefined): string {
  if (!timestamp) return "—";
  // Heuristic for sec/ms/µs, matching the Angular formatLastHeartbeat.
  let ms = timestamp;
  if (ms > 1e15) ms = ms / 1000; // microseconds
  else if (ms < 1e12) ms = ms * 1000; // seconds
  return new Date(ms).toLocaleString();
}

function countCamerasEnabled(device: DeviceDto): number {
  return Object.values(device.HealthReport?.Cameras ?? {}).filter((c) => c.Enabled).length;
}

export function DevicesList() {
  const { projectId } = useParams();
  const { project } = useOutletContext<{ project: ProjectDto | null }>();

  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<DeviceDto | "new" | null>(null);
  const [deleting, setDeleting] = useState<DeviceDto | null>(null);
  const [viewingHealth, setViewingHealth] = useState<DeviceDto | null>(null);
  const [viewingApiKey, setViewingApiKey] = useState<DeviceDto | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  function load() {
    if (!projectId) return;
    setLoading(true);
    Promise.all([deviceApi.getDevicesByProject(projectId), projectApi.getProjects()])
      .then(([d, p]) => {
        setDevices(d);
        setProjects(p);
      })
      .catch(() => setError("Failed to load devices"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [projectId]);

  async function handleSave(input: Parameters<typeof deviceApi.addDevice>[0]) {
    try {
      if (editing && editing !== "new") {
        await deviceApi.updateDevice(editing.Id, { ...input, ProjectId: projectId });
      } else {
        await deviceApi.addDevice({ ...input, ProjectId: projectId });
      }
      setEditing(null);
      load();
    } catch {
      setError("Failed to save device");
    }
  }

  async function handleDelete() {
    if (!deleting || !projectId) return;
    try {
      await deviceApi.deleteDevice(projectId, deleting.Id);
      setDeleting(null);
      load();
    } catch {
      setError("Failed to delete device");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Devices ({devices.length})</h1>
        <HasPermission permission={Permissions.Project.DevicesManage} projectId={projectId}>
          <button
            onClick={() => setEditing("new")}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Add Device
          </button>
        </HasPermission>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-neutral-600">Loading…</p>
      ) : (
        <table className="mt-4 w-full overflow-visible rounded-lg border border-neutral-200 bg-white text-sm">
          <thead className="bg-neutral-100 text-left text-neutral-700">
            <tr>
              <th className="px-4 py-2 font-medium">Device</th>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Id</th>
              <th className="px-4 py-2 font-medium">Last Heartbeat</th>
              <th className="px-4 py-2 font-medium">Cameras Enabled</th>
              <th className="px-4 py-2 font-medium">Tracking</th>
              <th className="px-4 py-2 font-medium">Heartbeat Interval</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.Id} className="relative border-t border-neutral-100">
                <td className="px-4 py-2 text-neutral-900">{device.Name}</td>
                <td className="px-4 py-2 text-neutral-600">{project?.Title ?? device.ProjectId}</td>
                <td className="px-4 py-2 font-mono text-xs text-neutral-500">{device.Id}</td>
                <td className="px-4 py-2 text-neutral-600">{formatLastHeartbeat(device.HealthReport?.Timestamp)}</td>
                <td className="px-4 py-2 text-neutral-600">{countCamerasEnabled(device)}</td>
                <td className="px-4 py-2 text-neutral-600">{device.Config?.Tracking?.Enabled ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-neutral-600">{device.Config?.HeartbeatInterval ?? "—"}</td>
                <td className="relative px-4 py-2 text-right">
                  <HasPermission permission={Permissions.Project.DevicesManage} projectId={projectId}>
                    <button
                      onClick={() => setOpenMenuFor(openMenuFor === device.Id ? null : device.Id)}
                      className="rounded-md px-2 py-1 text-neutral-600 hover:bg-neutral-100"
                      aria-label="Actions"
                    >
                      ⋮
                    </button>
                    {openMenuFor === device.Id && (
                      <div className="absolute right-4 top-9 z-10 w-40 rounded-md border border-neutral-200 bg-white py-1 text-left shadow-lg">
                        <button
                          onClick={() => {
                            setEditing(device);
                            setOpenMenuFor(null);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setViewingHealth(device);
                            setOpenMenuFor(null);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
                        >
                          Health Report
                        </button>
                        <button
                          onClick={() => {
                            setViewingApiKey(device);
                            setOpenMenuFor(null);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
                        >
                          Get API Key
                        </button>
                        <button
                          onClick={() => {
                            setDeleting(device);
                            setOpenMenuFor(null);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </HasPermission>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <DeviceForm
          device={editing === "new" ? undefined : editing}
          projects={projects}
          defaultProjectId={projectId}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete Device"
          message="Are you sure you want to delete this device?"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {viewingHealth && <DeviceHealthReport device={viewingHealth} onClose={() => setViewingHealth(null)} />}

      {viewingApiKey && projectId && (
        <DeviceApiInfo projectId={projectId} deviceId={viewingApiKey.Id} onClose={() => setViewingApiKey(null)} />
      )}
    </div>
  );
}
