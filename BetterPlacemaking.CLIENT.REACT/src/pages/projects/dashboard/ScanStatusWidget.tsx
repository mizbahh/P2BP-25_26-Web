import { HasPermission } from "../../../auth/HasPermission";
import { Permissions } from "../../../lib/permissions";

interface ScanStatusWidgetProps {
  lastScanTime: Date;
  formatTimeAgo: (date: Date) => string;
  projectId: string | undefined;
  scanLoading: boolean;
  scanMessage: string | null;
  onRefresh: () => void;
  onOpenModelPage: () => void;
  onRunFullScan: () => void;
}

/** Mirrors the Angular ScanStatusWidget. Backed by ScanService (scanApi.getScans/startScan
 * against /api/scan, an already-ported and mounted Express resource) plus the LiDAR device list
 * from deviceApi - real data, no stub. The "Last Scan" panel links to the project's 3D model
 * page (`/:projectId/model`); that Visualizer route isn't wired into the React app yet since the
 * Fusion/Visualizer pipeline hasn't been ported to the Express backend, so this link will not
 * resolve to anything until that page exists - preserved as-is to match the old Angular
 * behavior, same as its own "Project.Scans.Read"-gated `model` route being unported here. */
export function ScanStatusWidget({
  lastScanTime,
  formatTimeAgo,
  projectId,
  scanLoading,
  scanMessage,
  onRefresh,
  onOpenModelPage,
  onRunFullScan,
}: ScanStatusWidgetProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenModelPage}
          className="text-left text-lg font-semibold text-neutral-900 hover:underline"
        >
          Last Scan
        </button>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          ⟳
        </button>
      </div>

      <div className="flex cursor-pointer flex-col items-center justify-center py-4 text-center" onClick={onOpenModelPage}>
        <div className="mb-2 text-3xl font-bold text-neutral-900">{formatTimeAgo(lastScanTime)}</div>
        <div className="text-sm text-neutral-500">Last completed scan</div>
        {lastScanTime.getTime() > 0 && (
          <div className="mt-2 text-xs text-neutral-400">{lastScanTime.toLocaleString()}</div>
        )}
      </div>

      <div className="mt-4">
        <HasPermission permission={Permissions.Project.ScansStart} projectId={projectId}>
          <button
            type="button"
            onClick={onRunFullScan}
            disabled={scanLoading}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {scanLoading ? "Starting scan…" : "Run Full Scan"}
          </button>
        </HasPermission>
        {scanMessage && (
          <p className={`mt-2 text-center text-sm ${scanMessage.toLowerCase().includes("failed") ? "text-red-600" : "text-emerald-600"}`}>
            {scanMessage}
          </p>
        )}
      </div>
    </div>
  );
}
