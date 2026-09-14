import { api } from "../auth/apiClient";
import type { ScanRecordDto, ScanScheduleDto, ScanSettingsRequest, StartScanResult } from "../lib/scanTypes";

/**
 * Matches scan.routes.ts's `GET /api/scan/:projectId/:deviceId` (ScanController.GetScans
 * ported verbatim) - the scan history for one device, newest/oldest order as stored.
 */
export function getScans(projectId: string, deviceId: string): Promise<ScanRecordDto[]> {
  return api.get<ScanRecordDto[]>(`/api/scan/${projectId}/${deviceId}`);
}

/** Matches scan.routes.ts's `POST /api/scan/:projectId/:deviceId` (ScanController.StartScan). */
export function startScan(
  projectId: string,
  deviceId: string,
  settings: ScanSettingsRequest,
): Promise<StartScanResult> {
  return api.post<StartScanResult>(`/api/scan/${projectId}/${deviceId}`, settings);
}

/** Matches scan.routes.ts's `DELETE /api/scan/:projectId/:deviceId/:scanId` (ScanController.DeleteScan). */
export function deleteScan(projectId: string, deviceId: string, scanId: string): Promise<void> {
  return api.delete<void>(`/api/scan/${projectId}/${deviceId}/${scanId}`);
}

/** Matches scanSchedule.routes.ts's `GET /api/scan-schedule/:projectId` (ScanScheduleController.GetAll). */
export function getSchedules(projectId: string): Promise<ScanScheduleDto[]> {
  return api.get<ScanScheduleDto[]>(`/api/scan-schedule/${projectId}`);
}

/** Matches scanSchedule.routes.ts's `POST /api/scan-schedule/:projectId` (ScanScheduleController.Create). */
export function createSchedule(projectId: string, schedule: ScanScheduleDto): Promise<{ Id: string }> {
  return api.post<{ Id: string }>(`/api/scan-schedule/${projectId}`, schedule);
}

/**
 * Matches scanSchedule.routes.ts's `PUT /api/scan-schedule/:projectId/:scheduleId`
 * (ScanScheduleController.Update) - responds 204 with no body.
 */
export function updateSchedule(projectId: string, scheduleId: string, schedule: ScanScheduleDto): Promise<void> {
  return api.put<void>(`/api/scan-schedule/${projectId}/${scheduleId}`, schedule);
}

/**
 * Matches scanSchedule.routes.ts's `DELETE /api/scan-schedule/:projectId/:scheduleId`
 * (ScanScheduleController.Delete) - responds 204 with no body.
 */
export function deleteSchedule(projectId: string, scheduleId: string): Promise<void> {
  return api.delete<void>(`/api/scan-schedule/${projectId}/${scheduleId}`);
}
