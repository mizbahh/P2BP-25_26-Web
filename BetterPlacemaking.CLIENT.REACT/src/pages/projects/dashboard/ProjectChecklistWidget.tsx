import type { DeviceCounts, ProjectViewModel } from "../../../lib/dashboardTypes";

interface ProjectChecklistWidgetProps {
  project: ProjectViewModel;
  deviceCounts: DeviceCounts;
  onRefresh: () => void;
  onDevicesAddedClick: () => void;
  onOfflineDevicesFixedClick: () => void;
  onWarningsResolvedClick: () => void;
}

function ChecklistRow({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded px-2 py-2 text-left transition hover:bg-neutral-50"
    >
      <span className="text-neutral-700">{label}</span>
      <span className={`font-medium ${done ? "text-emerald-600" : "text-neutral-500"}`}>{done ? "Yes" : "No"}</span>
    </button>
  );
}

/** Mirrors the Angular ProjectChecklistWidget. Purely derived from ProjectService + DeviceService
 * data already fetched by Dashboard.tsx - real data, no stub. */
export function ProjectChecklistWidget({
  project,
  deviceCounts,
  onRefresh,
  onDevicesAddedClick,
  onOfflineDevicesFixedClick,
  onWarningsResolvedClick,
}: ProjectChecklistWidgetProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-900">Project Checklist</h3>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          ⟳
        </button>
      </div>

      <div className="mb-4">
        <div className="text-base font-semibold text-neutral-900">{project.title}</div>
        <div className="mt-1 text-sm text-neutral-500">{project.description}</div>
      </div>

      {project.checklistMessage && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {project.checklistMessage}
        </div>
      )}

      <div className="divide-y divide-neutral-100 border-b border-neutral-100">
        <ChecklistRow label="Devices added" done={deviceCounts.total > 0} onClick={onDevicesAddedClick} />
        <ChecklistRow label="Offline devices fixed" done={deviceCounts.offline === 0} onClick={onOfflineDevicesFixedClick} />
        <ChecklistRow label="Warnings resolved" done={deviceCounts.warning === 0} onClick={onWarningsResolvedClick} />
      </div>
      <div className="flex items-center justify-between px-2 py-2">
        <span className="text-neutral-700">Project ready</span>
        <span className={`font-medium ${project.progress === 100 ? "text-emerald-600" : "text-neutral-500"}`}>
          {project.progress === 100 ? "Yes" : "No"}
        </span>
      </div>
    </div>
  );
}
