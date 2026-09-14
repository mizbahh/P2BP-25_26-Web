import { api } from "../auth/apiClient";
import type { ScanRecordDto, ScanSettingsRequest, StartScanResult } from "../lib/scanTypes";

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
