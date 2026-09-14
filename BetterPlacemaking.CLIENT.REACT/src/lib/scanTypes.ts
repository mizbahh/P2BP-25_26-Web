/**
 * Wire shape returned by `GET /api/scan/:projectId/:deviceId` (and the single-scan
 * variant) - mirrors `ScanDto` on the server (models/scan.ts), which is a loosely-typed
 * passthrough of the Firestore scan document (`Record<string, unknown> & { Id: string }`,
 * with every Timestamp field rendered as an ISO-8601 string). Only the fields this client
 * actually reads are declared as named members; the index signature keeps the rest
 * passing through untyped rather than being dropped.
 */
export interface ScanRecordDto {
  Id: string;
  Status?: string | null;
  CreatedAt?: string | null;
  StartedAt?: string | null;
  FinishedAt?: string | null;
  ObjUrl?: string | null;
  Error?: string | null;
  [key: string]: unknown;
}

export type ScanResolution = 1 | 8 | 16 | 32 | 64;
export type ProtocolMode = "legacy" | "express" | "dense" | "ultra";
export type OrientationMode = "table" | "ceiling" | "wall" | "custom";
export type OutputMode = "filtered_only" | "raw_only" | "raw_and_filtered";
export type SplitMode = "none" | "front_back_180";
export type CaptureStrategy = "fixed_time" | "min_revolutions" | "hybrid";

/** Body of POST /api/scan/:projectId/:deviceId - field names are snake_case verbatim, they are
 * the literal C# property names carried through unchanged. */
export interface ScanSettingsRequest {
  scan_resolution: ScanResolution;
  protocol_mode: ProtocolMode;
  orientation_mode: OrientationMode;
  output_mode: OutputMode;
  split_mode: SplitMode;
  filter_enabled: boolean;
  capture_strategy: CaptureStrategy;
  min_revolutions_per_slice: 1 | 2 | 3;
  force_recalibration: boolean;
}

/** Matches the Angular scan-service's BASE_SCAN_SETTINGS - the default "quick" preset used by
 * the project Dashboard's one-click "Run Full Scan" action. */
export const BASE_SCAN_SETTINGS: ScanSettingsRequest = {
  scan_resolution: 8,
  protocol_mode: "legacy",
  orientation_mode: "table",
  output_mode: "filtered_only",
  split_mode: "none",
  filter_enabled: false,
  capture_strategy: "hybrid",
  min_revolutions_per_slice: 1,
  force_recalibration: false,
};

/** Result of POST /api/scan/:projectId/:deviceId. */
export interface StartScanResult {
  Id: string;
  Status: string | null;
}
