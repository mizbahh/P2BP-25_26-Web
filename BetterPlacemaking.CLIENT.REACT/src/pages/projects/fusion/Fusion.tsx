import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Modal } from "../../../components/Modal";
import { HasPermission } from "../../../auth/HasPermission";
import { Permissions } from "../../../lib/permissions";
import { ApiError } from "../../../auth/apiClient";
import * as fusionApi from "../../../services/fusionApi";
import type { FusionConfigDto, FusionRunDto, FusionRunStatus } from "../../../lib/fusionTypes";
import { FusionModal } from "./FusionModal";

const POLL_INTERVAL_MS = 6_000;

function formatUnix(unix?: number): string {
  if (!unix) return "—";
  const date = new Date(unix * 1000);
  return isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatDuration(run: FusionRunDto): string {
  if (!run.StartedAtUnix || !run.CompletedAtUnix) return "—";
  const secs = Math.round(run.CompletedAtUnix - run.StartedAtUnix);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatDateRange(run: FusionRunDto): string {
  if (!run.FromDateUnix || !run.ToDateUnix) return "—";
  const from = new Date(run.FromDateUnix * 1000).toLocaleDateString();
  const to = new Date(run.ToDateUnix * 1000).toLocaleDateString();
  return from === to ? from : `${from} – ${to}`;
}

function formatScheduleTime(config: FusionConfigDto): string {
  const h = String(config.ScheduledHourUtc).padStart(2, "0");
  const m = String(config.ScheduledMinuteUtc).padStart(2, "0");
  return `${h}:${m}`;
}

const STATUS_LABEL: Record<FusionRunStatus, string> = {
  running: "Running",
  cancelling: "Cancelling",
  cancelled: "Cancelled",
  success: "Success",
  failed: "Failed",
  unknown: "Unknown",
};

const STATUS_BADGE: Record<FusionRunStatus, string> = {
  running: "bg-indigo-50 text-indigo-700",
  cancelling: "bg-amber-50 text-amber-700",
  cancelled: "bg-neutral-100 text-neutral-600",
  success: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  unknown: "bg-neutral-100 text-neutral-600",
};

function StatusBadge({ status }: { status: FusionRunStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? STATUS_BADGE.unknown}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function isNotAvailable(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/** Message shown wherever a Fusion API call fails because the backend doesn't implement it yet. */
const NOT_AVAILABLE_MESSAGE =
  "Fusion isn't available yet — the backend doesn't implement the fusion API yet. This page is ahead of its backend on purpose so the UI can be reviewed early.";

function StatCard({ label, value, valueClassName, meta }: { label: string; value: string; valueClassName?: string; meta: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold text-neutral-900 ${valueClassName ?? ""}`}>{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{meta}</div>
    </div>
  );
}

/**
 * Schedule dialog for changing the daily UTC auto-fusion time. Kept inline (not its own file) -
 * it's a small form tightly coupled to Fusion's config state, same "trivial modal" judgment call
 * used elsewhere in this codebase.
 */
function ScheduleDialog({
  projectId,
  config,
  onClose,
  onSaved,
}: {
  projectId?: string;
  config: FusionConfigDto | null;
  onClose: () => void;
  onSaved: (config: FusionConfigDto) => void;
}) {
  const [hour, setHour] = useState(config?.ScheduledHourUtc ?? 0);
  const [minute, setMinute] = useState(config?.ScheduledMinuteUtc ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notAvailable, setNotAvailable] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setNotAvailable(false);
    try {
      const updated = await fusionApi.updateConfig({
        ScheduledHourUtc: hour,
        ScheduledMinuteUtc: minute,
        Enabled: config?.Enabled ?? true,
        ProjectId: projectId,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      if (isNotAvailable(err)) setNotAvailable(true);
      else setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Set Automatic Fusion Time" onClose={onClose} widthClassName="max-w-sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          Choose the daily time (UTC) when the fusion pipeline will run automatically.
        </p>
        <div className="flex items-center justify-center gap-2">
          <input
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value))))}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-center text-sm"
            aria-label="Hour (UTC)"
          />
          <span className="text-neutral-500">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minute}
            onChange={(e) => setMinute(Math.min(59, Math.max(0, Number(e.target.value))))}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-center text-sm"
            aria-label="Minute (UTC)"
          />
          <span className="text-sm text-neutral-500">UTC</span>
        </div>

        {notAvailable && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">{NOT_AVAILABLE_MESSAGE}</p>}
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <HasPermission permission={Permissions.Project.ScanSchedulesManage} projectId={projectId}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Time"}
            </button>
          </HasPermission>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Data Fusion page - merges multi-camera tracking data into unified pedestrian identities.
 *
 * IMPORTANT: the Fusion engine has not been ported to BetterPlacemaking.SERVER.EXPRESS yet (no
 * fusion.routes.ts/fusionService.ts exist). This page is built ahead of its backend on purpose,
 * per product direction, to prove out frontend navigation/UI. Every data call below hits the
 * intended `/api/fusion/*` endpoints (documented in services/fusionApi.ts) and is expected to
 * 404 until that backend work lands - handled as a graceful "Fusion isn't available yet" state
 * rather than a crash.
 */
export function Fusion() {
  const { projectId } = useParams();

  const [history, setHistory] = useState<FusionRunDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyNotAvailable, setHistoryNotAvailable] = useState(false);
  const [historyError, setHistoryError] = useState(false);

  const [config, setConfig] = useState<FusionConfigDto | null>(null);

  const [fusionModalOpen, setFusionModalOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const [deletingRun, setDeletingRun] = useState<FusionRunDto | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);
  const [downloadingRunId, setDownloadingRunId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;

    function loadHistory() {
      fusionApi
        .getHistory(projectId!)
        .then((runs) => {
          if (cancelled) return;
          setHistory(runs);
          setHistoryLoading(false);
          setHistoryNotAvailable(false);
          setHistoryError(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setHistoryLoading(false);
          if (isNotAvailable(err)) setHistoryNotAvailable(true);
          else setHistoryError(true);
        });
    }

    loadHistory();
    const timer = setInterval(loadHistory, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fusionApi
      .getConfig(projectId)
      .then(setConfig)
      .catch(() => setConfig(null));
  }, [projectId]);

  const hasRunningFusion = history.some((r) => r.Status === "running" || r.Status === "cancelling");
  const lastRun = history[0] ?? null;
  const successCount = history.filter((r) => r.Status === "success").length;
  const failedCount = history.filter((r) => r.Status === "failed").length;

  function handleTriggered(run: FusionRunDto) {
    setFusionModalOpen(false);
    setHistory((prev) => [run, ...prev]);
  }

  async function handleCancel(run: FusionRunDto) {
    if (run.Status !== "running") return;
    setCancellingRunId(run.Id);
    setActionError(null);
    try {
      await fusionApi.cancelRun(run.Id);
      setHistory((prev) => prev.map((r) => (r.Id === run.Id ? { ...r, Status: "cancelling" } : r)));
    } catch (err) {
      setActionError(isNotAvailable(err) ? NOT_AVAILABLE_MESSAGE : "Failed to cancel fusion run.");
    } finally {
      setCancellingRunId(null);
    }
  }

  async function handleDownload(run: FusionRunDto) {
    if (!run.OutputGcsPath) return;
    setDownloadingRunId(run.Id);
    setActionError(null);
    try {
      const blob = await fusionApi.downloadRun(run.Id);
      const filename = run.OutputGcsPath.split("/").pop() ?? "fused_tracks.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(isNotAvailable(err) ? NOT_AVAILABLE_MESSAGE : "Failed to download fusion run.");
    } finally {
      setDownloadingRunId(null);
    }
  }

  async function handleDelete() {
    if (!deletingRun) return;
    const run = deletingRun;
    setDeletingRun(null);
    setDeletingRunId(run.Id);
    setActionError(null);
    try {
      await fusionApi.deleteRun(run.Id);
      setHistory((prev) => prev.filter((r) => r.Id !== run.Id));
    } catch (err) {
      setActionError(isNotAvailable(err) ? NOT_AVAILABLE_MESSAGE : "Failed to delete run.");
    } finally {
      setDeletingRunId(null);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Data Fusion</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Merge multi-camera tracking data into unified pedestrian identities
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HasPermission permission={Permissions.Project.ScanSchedulesManage} projectId={projectId}>
            <button
              type="button"
              onClick={() => setScheduleDialogOpen(true)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Change Auto-Fusion Time
            </button>
          </HasPermission>
          <HasPermission permission={Permissions.Project.ScansStart} projectId={projectId}>
            <button
              type="button"
              onClick={() => setFusionModalOpen(true)}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              title="Select a date range and run the fusion pipeline"
            >
              {hasRunningFusion ? "Fusion running…" : "Run Manual Fusion"}
            </button>
          </HasPermission>
        </div>
      </div>

      {hasRunningFusion && (
        <p className="mt-4 rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">
          Fusion is running — this may take a few minutes. Results will appear below automatically.
        </p>
      )}

      {actionError && (
        <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-700">{actionError}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Last Run"
          value={lastRun ? STATUS_LABEL[lastRun.Status] : "—"}
          valueClassName={
            lastRun?.Status === "success" ? "text-green-600" : lastRun?.Status === "failed" ? "text-red-600" : ""
          }
          meta={lastRun ? formatUnix(lastRun.StartedAtUnix) : "No runs yet"}
        />
        <StatCard
          label="Successful"
          value={String(successCount)}
          valueClassName={successCount > 0 ? "text-green-600" : ""}
          meta={`of ${history.length} total`}
        />
        <StatCard
          label="Failed"
          value={String(failedCount)}
          valueClassName={failedCount > 0 ? "text-red-600" : ""}
          meta="errors"
        />
        <StatCard
          label="Auto-Run"
          value={config ? (config.Enabled ? "Enabled" : "Disabled") : "—"}
          valueClassName={config?.Enabled ? "text-green-600" : config?.Enabled === false ? "text-neutral-500" : ""}
          meta={config ? `Daily at ${formatScheduleTime(config)} UTC` : "nightly schedule"}
        />
      </div>

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="text-sm font-semibold text-neutral-900">Fusion History</span>
          <span className="text-xs text-neutral-500">Refreshes every 6 seconds</span>
        </div>

        {historyLoading ? (
          <p className="p-6 text-center text-sm text-neutral-600">Loading runs…</p>
        ) : historyNotAvailable ? (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-neutral-900">Fusion isn't available yet</p>
            <p className="mt-1 text-sm text-neutral-500">{NOT_AVAILABLE_MESSAGE}</p>
          </div>
        ) : historyError ? (
          <p className="p-6 text-center text-sm text-red-700">Failed to load fusion history.</p>
        ) : history.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-neutral-900">No fusion runs yet</p>
            <p className="mt-1 text-sm text-neutral-500">Click "Run Manual Fusion" above to start one.</p>
            <HasPermission permission={Permissions.Project.ScansStart} projectId={projectId}>
              <button
                type="button"
                onClick={() => setFusionModalOpen(true)}
                className="mt-3 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Run Manual Fusion
              </button>
            </HasPermission>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left text-neutral-700">
              <tr>
                <th className="px-4 py-2 font-medium">Date Range</th>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Triggered By</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {history.map((run) => (
                <tr key={run.Id} className="border-t border-neutral-100">
                  <td className="px-4 py-2">
                    <div className="text-neutral-900">{formatDateRange(run)}</div>
                    {run.ErrorMessage && (
                      <div className="max-w-xs truncate text-xs text-red-600" title={run.ErrorMessage}>
                        {run.ErrorMessage}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{formatUnix(run.StartedAtUnix)}</td>
                  <td className="px-4 py-2 text-neutral-600">{run.Status !== "running" ? formatDuration(run) : "—"}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={run.Status} />
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      {run.TriggeredBy === "manual" ? "Manual" : run.TriggeredBy === "scheduled" ? "Scheduled" : "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {run.Status === "running" && (
                        <HasPermission permission={Permissions.Project.ScansStart} projectId={projectId}>
                          <button
                            type="button"
                            onClick={() => void handleCancel(run)}
                            disabled={cancellingRunId === run.Id}
                            title="Stop this fusion run"
                            className="rounded-md px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                          >
                            {cancellingRunId === run.Id ? "Stopping…" : "Stop"}
                          </button>
                        </HasPermission>
                      )}

                      {run.Status === "success" && run.OutputGcsPath && (
                        <HasPermission permission={Permissions.Project.Export} projectId={projectId}>
                          <button
                            type="button"
                            onClick={() => void handleDownload(run)}
                            disabled={downloadingRunId === run.Id}
                            title="Download fused data (JSON)"
                            className="rounded-md px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
                          >
                            {downloadingRunId === run.Id ? "Downloading…" : "Download"}
                          </button>
                        </HasPermission>
                      )}

                      {run.Status !== "running" && run.Status !== "cancelling" && (
                        <HasPermission permission={Permissions.Project.ScansDelete} projectId={projectId}>
                          <button
                            type="button"
                            onClick={() => setDeletingRun(run)}
                            disabled={deletingRunId === run.Id}
                            title="Delete this run"
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            {deletingRunId === run.Id ? "Deleting…" : "Delete"}
                          </button>
                        </HasPermission>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {fusionModalOpen && (
        <FusionModal projectId={projectId} onClose={() => setFusionModalOpen(false)} onTriggered={handleTriggered} />
      )}

      {scheduleDialogOpen && (
        <ScheduleDialog
          projectId={projectId}
          config={config}
          onClose={() => setScheduleDialogOpen(false)}
          onSaved={setConfig}
        />
      )}

      {deletingRun && (
        <ConfirmDialog
          title="Delete Run"
          message={`Delete fusion run for ${formatDateRange(deletingRun)}? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingRun(null)}
        />
      )}
    </div>
  );
}
