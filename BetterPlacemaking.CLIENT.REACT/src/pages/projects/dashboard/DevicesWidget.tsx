import type { DeviceDto } from "../../../lib/deviceTypes";
import type { DeviceStatus } from "../../../lib/dashboardTypes";
import { Button } from "../../../components/prime";

interface DevicesWidgetProps {
  devices: DeviceDto[];
  loading: boolean;
  error: string | null;
  getDeviceStatus: (device: DeviceDto) => DeviceStatus;
  getDeviceLastSeen: (device: DeviceDto) => string;
  onRefresh: () => void;
  onOpenDevicesPage: () => void;
}

const AppDevicesWidget = "app-devices-widget" as unknown as "div";

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    online: "bg-green-500",
    offline: "bg-red-500",
    warning: "bg-yellow-500",
  };
  return colors[status] || "bg-gray-400";
}

/** Mirrors the Angular DevicesWidget. */
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
    <AppDevicesWidget>
      <div className="card bg-surface-0 dark:bg-surface-900 shadow-sm rounded-xl border border-surface-300 dark:border-surface-700 p-6 bg-black">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button type="button" className="text-xl font-semibold text-left hover:underline" onClick={onOpenDevicesPage}>
              Device Status
            </button>

            <div className="text-xs text-gray-500 mt-1">
              Showing all devices temporarily until devices are assigned under projects.
            </div>
          </div>

          <Button icon="pi pi-refresh" text rounded onClick={onRefresh} />
        </div>

        {loading && <div className="text-sm text-gray-500">Loading devices...</div>}

        {error && <div className="text-sm text-red-500">{error}</div>}

        {!loading && !error && devices.length === 0 && (
          <div className="text-sm text-gray-500">No devices are assigned yet.</div>
        )}

        {devices.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {devices.map((device) => (
              <div
                key={device.Id}
                className="flex items-center justify-between p-2 border-b border-surface-200 dark:border-surface-700"
              >
                <div className="flex items-center">
                  <span className={"w-3 h-3 rounded-full mr-3 " + getStatusColor(getDeviceStatus(device))}></span>

                  <div>
                    <div className="font-medium">{device.Name}</div>
                    <div className="text-sm text-muted-color">
                      Resolution: {device.Config?.Camera?.Resolution ?? "N/A"}
                    </div>
                    <div className="text-sm text-muted-color">Version: {device.Config?.Version ?? "Unknown"}</div>
                  </div>
                </div>

                <div className="text-sm text-muted-color">Last seen: {getDeviceLastSeen(device)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppDevicesWidget>
  );
}
