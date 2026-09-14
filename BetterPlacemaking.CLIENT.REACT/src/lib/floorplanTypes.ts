/**
 * Mirrors BetterPlacemaking.SERVER.EXPRESS/src/models/floorplanLibrary.ts's wire DTOs
 * verbatim (field-for-field, PascalCase) - the shape returned by
 * `GET /api/floorplan-library` (see services/floorplanLibraryApi.ts).
 */

export interface FloorplanCalibrationDto {
  ReferencePoints: number[][];
  ReferenceDistanceMm: number;
  MmPerPixel: number;
  OriginFp: number[];
  CalibratedAtUtc: string;
}

export interface FloorplanLibraryItemDto {
  Id: string;
  ProjectId?: string | null;
  Nickname: string;
  ImagePath: string;
  ImageDownloadUrl?: string | null;
  ImageDownloadUrlExpiresAt?: string | null;
  ImageContentType: string;
  ImageSizeBytes: number;
  ImageWidth: number;
  ImageHeight: number;
  Calibration?: FloorplanCalibrationDto | null;
  CreatedAtUtc: string;
  UpdatedAtUtc: string;
}
