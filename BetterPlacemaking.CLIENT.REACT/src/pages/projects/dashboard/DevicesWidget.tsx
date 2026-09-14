import type { DeviceDto } from "../../../lib/deviceTypes";
import type { DeviceStatus } from "../../../lib/dashboardTypes";

interface DevicesWidgetProps {
  devices: DeviceDto[];
  loading: boolean;
  error: string | null;
  getDeviceStatus: (device: DeviceDto) => DeviceStatus;
  getDeviceLastSeen: (device: DeviceDto) => string;
  onRefresh: () => void;
  onOpenDevicesPage: () => void;
}

const STATUS_DOT: Record<DeviceStatus, string> = {
  online: "bg-emerald-500",
  offline: "bg-red-500",
  warning: "bg-amber-500",
};

/** Mirrors the Angular DevicesWidget. Backed by DeviceService.getDevicesByProject
 * (deviceApi.getDevicesByProject), an already-ported Express resource - real data, no stub. */
export function DevicesWidget({
  devices,
  loading,
  error,
  getDeviceStatus,
  getDeviceLastSeen,
  onRefresh,
  onOpenDevicesPage,
}: DevicesWidgetProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <button
            type="button"
            onClick={onOpenDevicesPage}
            className="text-left text-lg font-semibold text-neutral-900 hover:underline"
          >
            Device Status
          </button>
          <div className="mt-1 text-xs text-neutral-500">Showing all devices assigned to this project.</div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        >
          ⟳
        </button>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading devices…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && devices.length === 0 && (
        <p className="text-sm text-neutral-500">No devices are assigned yet.</p>
      )}

      {devices.length > 0 && (
        <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
          {devices.map((device) => (
            <div
              key={device.Id}
              className="flex items-center justify-between border-b border-neutral-100 py-2 last:border-0"
            >
              <div className="flex items-center">
                <span className={`mr-3 h-2.5 w-2.5 flex-shrink-0 rounded-full ${STATUS_DOT[getDeviceStatus(device)]}`} />
                <div>
                  <div className="font-medium text-neutral-900">{device.Name}</div>
                  <div className="text-xs text-neutral-500">Resolution: {device.Config?.Camera?.Resolution ?? "N/A"}</div>
                  <div className="text-xs text-neutral-500">Version: {device.Config?.Version ?? "Unknown"}</div>
                </div>
              </div>
              <div className="text-xs text-neutral-500">Last seen: {getDeviceLastSeen(device)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
