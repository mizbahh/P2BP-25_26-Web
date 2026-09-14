/** View-model shapes for the project Dashboard page, mirroring the Angular dashboard.ts's
 * ProjectViewModel/Alert interfaces and the counts objects computed from device data. */

export interface ProjectViewModel {
  title: string;
  status: "active" | "inactive" | "completed";
  description: string;
  progress: number;
  checklistMessage: string | null;
}

export interface DeviceCounts {
  total: number;
  online: number;
  offline: number;
  warning: number;
}

export type DeviceStatus = "online" | "offline" | "warning";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface AlertCounts {
  total: number;
  critical: number;
  high: number;
  unresolved: number;
}
