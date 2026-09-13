/**
 * Ported from BetterPlacemaking.SERVER/Services/ScanCombine/ScanCalibrationModels.cs
 * (the request/DTO shapes) and BetterPlacemaking.SERVER/Services/ScanCombine/Point.cs
 * (the 2D point used by the preview renderer). Scan documents themselves are NOT
 * redefined here - see models/scanDevice.ts's Scan/ScanDoc, which
 * scanCalibrationService.ts imports and reuses (ScanCalibrationController talks to the
 * same `projects/{projectId}/devices/{deviceId}/scans` Firestore subtree ScanService.cs
 * does, just directly via FirestoreDb rather than through ScanService).
 */

/** Mirrors ScanCombine.XyzPoint - one point in a raw .xyz point-cloud file. */
export interface XyzPoint {
  X: number;
  Y: number;
  Z: number;
}

/**
 * Mirrors ScanCombine.XyzPoint.Distance() - the XY-plane (polar) distance from the
 * origin; Z is intentionally excluded, exactly as in the source.
 */
export function xyzDistance(p: XyzPoint): number {
  return Math.sqrt(p.X * p.X + p.Y * p.Y);
}

/** Mirrors ScanCombine.Point (used only by the flatten/preview path - X/Y only, no Z). */
export interface PreviewPoint {
  x: number;
  y: number;
}

/** Mirrors ScanCombine.Point.distance(). */
export function previewPointDistance(p: PreviewPoint): number {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

/** One item of CombineScansRequest.Items - mirrors ScanCombine.CombineScanItemRequest. */
export interface CombineScanItemRequest {
  ScanId: string;
  XTranslation: number;
  YTranslation: number;
  Theta: number;
}

/**
 * Body of POST /:projectId/:deviceId/combine - mirrors ScanCombine.CombineScansRequest.
 *
 * NOTE: ScalarMmPerPixel is `[JsonPropertyName("scalar_mm_per_pixel")]` on the old
 * server - the one field in this whole migration that isn't PascalCase over the wire.
 * scanCalibration.routes.ts reads `req.body.scalar_mm_per_pixel` to match.
 *
 * OutputName defaults to "calibrationScan" (a C# property initializer) when the field
 * is omitted from the request JSON entirely - the route mirrors that default.
 */
export interface CombineScansRequest {
  OutputName: string | null;
  ScalarMmPerPixel: number | null;
  Items: CombineScanItemRequest[];
}

/**
 * Mirrors ScanCombine.CombineCloudInput - one already-resolved local .xyz file path
 * plus the polar transform (translation + rotation) to apply to it, as built by
 * ScanCalibrationController.CombineScans from a CombineScanItemRequest.
 */
export interface CombineCloudInput {
  XyzFilePath: string;
  XTranslation: number;
  YTranslation: number;
  Theta: number;
}

/** Mirrors ScanCombine.CombinedScanResult. */
export interface CombinedScanResult {
  OutputFilePath: string;
  OutputFileName: string;
}
