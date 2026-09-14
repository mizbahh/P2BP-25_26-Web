import { useState } from "react";
import { Modal } from "../../../components/Modal";
import { HasPermission } from "../../../auth/HasPermission";
import { Permissions } from "../../../lib/permissions";
import { ApiError } from "../../../auth/apiClient";
import * as fusionApi from "../../../services/fusionApi";
import type { FusionRunDto } from "../../../lib/fusionTypes";

interface FusionModalProps {
  projectId?: string;
  onClose: () => void;
  /** Called after a fusion run is successfully triggered, so the caller can refresh its history. */
  onTriggered: (run: FusionRunDto) => void;
}

function toLocalInputValue(date: Date): string {
  // yyyy-MM-ddThh:mm, in the browser's local timezone, for a datetime-local input.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultFromDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return d;
}

function defaultToDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() - 1);
}

/**
 * Ported from the Angular fusion-modal - a date-range picker that triggers a manual fusion run.
 * Backend note: POST /api/fusion/trigger doesn't exist on Express yet (no fusion.routes.ts), so
 * submitting here is expected to fail with a 404 until that route is built - see fusionApi.ts.
 */
export function FusionModal({ projectId, onClose, onTriggered }: FusionModalProps) {
  const [fromDate, setFromDate] = useState(toLocalInputValue(defaultFromDate()));
  const [toDate, setToDate] = useState(toLocalInputValue(defaultToDate()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notAvailable, setNotAvailable] = useState(false);

  const fromMs = fromDate ? new Date(fromDate).getTime() : NaN;
  const toMs = toDate ? new Date(toDate).getTime() : NaN;
  const dateRangeValid = !fromDate || !toDate || fromMs < toMs;
  const canSubmit = !!fromDate && !!toDate && dateRangeValid && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNotAvailable(false);

    try {
      const run = await fusionApi.triggerFusion({
        FromDateUnix: fromMs / 1000,
        ToDateUnix: toMs / 1000,
        ProjectId: projectId,
      });
      onTriggered(run);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotAvailable(true);
      } else {
        setError("Failed to trigger fusion. Check server connectivity and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Run Manual Fusion" onClose={onClose} widthClassName="max-w-2xl">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          Select the date range to fuse. All sensor data captured between the two timestamps will be processed.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-neutral-700">
            From
            <input
              type="datetime-local"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="block text-sm font-medium text-neutral-700">
            To
            <input
              type="datetime-local"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>

        {!dateRangeValid && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">"From" date must be before "To" date.</p>
        )}

        {notAvailable && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
            Fusion isn't available yet — the backend doesn't implement <code>POST /api/fusion/trigger</code> yet.
          </p>
        )}
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <HasPermission permission={Permissions.Project.ScansStart} projectId={projectId}>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {submitting ? "Running…" : "Run Fusion"}
            </button>
          </HasPermission>
        </div>
      </div>
    </Modal>
  );
}
