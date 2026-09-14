import type { ReactNode } from "react";
import type { AlertCounts, DeviceCounts, ProjectViewModel } from "../../../lib/dashboardTypes";

interface StatsWidgetProps {
  project: ProjectViewModel;
  deviceCounts: DeviceCounts;
  alertCounts: AlertCounts;
  onRefresh: () => void;
  onProjectProgressClick: () => void;
  onDevicesClick: () => void;
  onAlertsClick: () => void;
}

function statusLabel(status: ProjectViewModel["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label="Refresh"
      className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
    >
      ⟳
    </button>
  );
}

function StatCard({
  label,
  value,
  footer,
  onClick,
  onRefresh,
}: {
  label: string;
  value: number | string;
  footer: ReactNode;
  onClick: () => void;
  onRefresh: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="col-span-12 cursor-pointer rounded-lg border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-indigo-300 md:col-span-4"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span className="block text-sm font-medium text-neutral-500">{label}</span>
          <div className="mt-2 text-xl font-semibold text-neutral-900">{value}</div>
        </div>
        <RefreshButton onClick={onRefresh} />
      </div>
      <div className="text-sm">{footer}</div>
    </div>
  );
}

/** Mirrors the Angular StatsWidget's three summary cards. Backed by ProjectService (via the
 * project passed in from ProjectWorkspace's Outlet context) and DeviceService (via the
 * dashboard's own device fetch) - both already-ported Express resources. The "Warnings" card
 * that existed in the Angular template is commented out there too; omitted here to match. */
export function StatsWidget({
  project,
  deviceCounts,
  alertCounts,
  onRefresh,
  onProjectProgressClick,
  onDevicesClick,
  onAlertsClick,
}: StatsWidgetProps) {
  return (
    <>
      <StatCard
        label="Project Progress"
        value={`${project.progress}%`}
        footer={
          <>
            <span className="font-medium text-indigo-600">{statusLabel(project.status)}</span>
            <span className="text-neutral-500"> project status</span>
          </>
        }
        onClick={onProjectProgressClick}
        onRefresh={onRefresh}
      />
      <StatCard
        label="Devices"
        value={deviceCounts.total}
        footer={
          <>
            <span className="font-medium text-indigo-600">{deviceCounts.online}</span>
            <span className="text-neutral-500"> online now</span>
          </>
        }
        onClick={onDevicesClick}
        onRefresh={onRefresh}
      />
      <StatCard
        label="Alerts"
        value={alertCounts.unresolved}
        footer={
          <>
            <span className="font-medium text-indigo-600">{alertCounts.critical}</span>
            <span className="text-neutral-500"> critical alerts</span>
          </>
        }
        onClick={onAlertsClick}
        onRefresh={onRefresh}
      />
    </>
  );
}
