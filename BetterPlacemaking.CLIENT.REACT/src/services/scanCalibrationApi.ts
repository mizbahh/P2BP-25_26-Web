import { API_BASE_URL } from "../lib/env";
import { api } from "../auth/apiClient";

/**
 * Matches scanCalibration.routes.ts, mounted at `/api/scan-calibration`
 * (ScanCalibrationController ported verbatim). Per that route file's header comment,
 * ALL FOUR endpoints below are intentionally unauthenticated on the real backend - a
 * carried-over gap from the old ASP.NET server (no [Authorize] there either), not a
 * porting artifact - so none of these calls attach a bearer token, matching the old
 * Angular ScanCalibrationService which used plain fetch/HttpClient URLs the same way.
 */

/**
 * GET /:projectId/:deviceId/:scanId/preview - returns a flattened top-down PNG preview
 * of a scan's point cloud. Unauthenticated, so this returns a plain URL (not routed
 * through the `api` fetch wrapper) for direct use as an <img src>, exactly like the old
 * Angular ScanCalibrationService.getPreview.
 */
export function getPreviewUrl(projectId: string, deviceId: string, scanId: string): string {
  return `${API_BASE_URL}/api/scan-calibration/${encodeURIComponent(projectId)}/${encodeURIComponent(deviceId)}/${encodeURIComponent(scanId)}/preview`;
}

/**
 * GET /:projectId/:deviceId/:scanId/download - raw .xyz file download. Same "plain URL"
 * shape as getPreviewUrl, for use as an <a href download>.
 */
export function getDownloadUrl(projectId: string, deviceId: string, scanId: string): string {
  return `${API_BASE_URL}/api/scan-calibration/${encodeURIComponent(projectId)}/${encodeURIComponent(deviceId)}/${encodeURIComponent(scanId)}/download`;
}

export interface UploadXyzResult {
  Id: string;
  Status: string;
  ObjUrl: string;
  OriginalFileName: string;
}

/**
 * Matches POST /:projectId/:deviceId/upload-xyz. The real backend has no multipart
 * parser (see the route file's comment) and expects JSON `{ FileBase64, FileName }`
 * instead of the old Angular client's `multipart/form-data` upload - pass the raw
 * base64 payload (no `data:...;base64,` prefix) via fileToBase64 below.
 */
export function uploadXyz(
  projectId: string,
  deviceId: string,
  fileBase64: string,
  fileName: string,
): Promise<UploadXyzResult> {
  return api.post<UploadXyzResult>(`/api/scan-calibration/${projectId}/${deviceId}/upload-xyz`, {
    FileBase64: fileBase64,
    FileName: fileName,
  });
}

/** Reads a File into a raw base64 string (no `data:...;base64,` prefix) for uploadXyz. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export interface CombineScanItemRequest {
  ScanId: string;
  XTranslation: number;
  YTranslation: number;
  Theta: number;
}

/**
 * Matches CombineScansRequest exactly (models/scanCalibration.ts on the server), field
 * names and all.
 *
 * NOTE: `scalar_mm_per_pixel` must stay exactly that key - it is the one field with an
 * explicit `[JsonPropertyName]` on the old server, so unlike every other field it does
 * NOT bind case-insensitively from a differently-punctuated name. Every other field
 * here is PascalCase and binds case-insensitively.
 *
 * The old Angular client sent this whole payload as `output_name`/`x_translation`/
 * `y_translation`/lowercase `scanId`, which - per the server model's own comment - binds
 * `scalar_mm_per_pixel` and `Items[].ScanId`/`Theta` correctly (case-insensitive) but
 * silently leaves `OutputName` at its "calibrationScan" default and BOTH per-scan
 * translations at 0 (only rotation ever applied). That is a live bug in the old system,
 * not a porting artifact. This client intentionally sends the exact names that bind so
 * translation moves are not silently dropped.
 */
export interface CombineScansRequest {
  OutputName: string;
  scalar_mm_per_pixel: number | null;
  Items: CombineScanItemRequest[];
}

export interface CombineScansResult {
  Id: string;
  Status: string;
  ObjUrl: string;
  OriginalFileName: string;
  IsCombinedCalibrationScan: boolean;
}

/** Matches POST /:projectId/:deviceId/combine. */
export function combine(
  projectId: string,
  deviceId: string,
  payload: CombineScansRequest,
): Promise<CombineScansResult> {
  return api.post<CombineScansResult>(`/api/scan-calibration/${projectId}/${deviceId}/combine`, payload);
}
