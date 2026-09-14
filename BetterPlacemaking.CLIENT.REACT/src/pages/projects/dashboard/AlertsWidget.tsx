import type { AlertCounts, DashboardAlert } from "../../../lib/dashboardTypes";

interface AlertsWidgetProps {
  alerts: DashboardAlert[];
  alertCounts: AlertCounts;
  formatTimeAgo: (date: Date) => string;
  onRefresh: () => void;
  onOpenDevicesPage: () => void;
}

const SEVERITY_BORDER: Record<DashboardAlert["severity"], string> = {
  critical: "border-red-400",
  high: "border-orange-400",
  medium: "border-yellow-400",
  low: "border-blue-400",
};

const SEVERITY_BADGE: Record<DashboardAlert["severity"], string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-blue-100 text-blue-800",
};

/** Mirrors the Angular AlertsWidget. Alerts aren't a real backend resource (there's no Firestore
 * "alerts" collection) - the Angular dashboard synthesized them client-side from
 * DeviceDto.HealthReport (offline/degraded-service detection). Dashboard.tsx ports that same
 * derivation, so this widget still reflects real device data, not fake data. */
export function AlertsWidget({ alerts, alertCounts, formatTimeAgo, onRefresh, onOpenDevicesPage }: AlertsWidgetProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDevicesPage}
            className="text-left text-lg font-semibold text-neutral-900 hover:underline"
          >
            Alerts
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

        <button type="button" onClick={onOpenDevicesPage} className="flex items-center gap-2 text-sm hover:opacity-80">
          {alertCounts.unresolved > 0 && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
              {alertCounts.unresolved}
            </span>
          )}
          <span className="text-neutral-600">{alertCounts.unresolved} unresolved</span>
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onOpenDevicesPage}
          className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center transition hover:opacity-80"
        >
          <div className="text-3xl font-bold text-neutral-900">{alertCounts.high}</div>
          <div className="mt-1 text-sm text-neutral-500">High</div>
        </button>
        <button
          type="button"
          onClick={onOpenDevicesPage}
          className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center transition hover:opacity-80"
        >
          <div className="text-3xl font-bold text-neutral-900">{alertCounts.critical}</div>
          <div className="mt-1 text-sm text-neutral-500">Critical</div>
        </button>
      </div>

      <h4 className="mb-3 text-sm font-semibold text-neutral-900">Recent Alerts</h4>

      {alerts.length === 0 ? (
        <p className="text-sm text-neutral-500">No active alerts.</p>
      ) : (
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {alerts.map((alert) => (
            <div key={alert.id} className={`rounded border border-neutral-200 border-l-4 p-3 ${SEVERITY_BORDER[alert.severity]}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[alert.severity]}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <div className="mt-2 text-sm text-neutral-700">{alert.message}</div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="text-xs text-neutral-500">{formatTimeAgo(alert.timestamp)}</span>
                  <span className={alert.resolved ? "text-emerald-500" : "text-red-500"}>{alert.resolved ? "✓" : "!"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
