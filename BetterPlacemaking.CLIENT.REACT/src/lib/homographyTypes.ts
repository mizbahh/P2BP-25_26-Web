/**
 * Ported field-for-field (PascalCase) from
 * BetterPlacemaking.SERVER.EXPRESS/src/models/homography.ts's wire DTOs - only the subset
 * used by the puzzle workspace page (Puzzle.tsx) and its ready-guard
 * (routes/RequirePuzzleReady.tsx). See that file for the full DTO set (submit-local,
 * submit-sightings, compute-lock, intrinsics, session-status are server<->device DTOs not
 * used by this client page).
 */

export type Matrix3x3 = number[][];

export interface PuzzlePieceMetadataDto {
  PuzzlePieceId: string;
  DeviceId: string;
  CameraMac: string;
  LocalHomographyId: string;
  LocalHomographyHash: string;
  HLocalCanvas: Matrix3x3;
  SourceFrameSize: number[];
  PuzzlePieceSize: number[];
  SourceSnapshotPath?: string | null;
  UsedUndistortedImage: boolean;
  UndistortMode: string;
  BboxTrimPct: number;
  HomographyFile: string;
  MetadataPath?: string | null;
  MetadataDownloadUrl?: string | null;
  MetadataDownloadUrlExpiresAt?: string | null;
  GeneratedAt: string;
}

export interface PuzzlePieceDto {
  PuzzlePieceId: string;
  DeviceId: string;
  CameraMac: string;
  /** "ready" | "missing_snapshot" | "generation_unsupported" | "generation_failed" (see homographyService.ts). */
  Status: string;
  PuzzlePiecePath?: string | null;
  PuzzlePieceDownloadUrl?: string | null;
  PuzzlePieceDownloadUrlExpiresAt?: string | null;
  Metadata?: PuzzlePieceMetadataDto | null;
  Error?: string | null;
}

export interface LocalHomographyWorkspaceDto {
  HomographyId: string;
  DeviceId: string;
  CameraMac: string;
  Matrix: Matrix3x3;
  FrameSize: number[];
  TimestampUnix: number;
  SnapshotPath?: string | null;
  UsedUndistortedImage?: boolean | null;
  LocalHomographyHash: string;
}

export interface HomographyLockGroupDto {
  GroupId: string;
  CameraMacs: string[];
}

export interface GlobalHomographyPlacementDto {
  PuzzlePieceId: string;
  DeviceId: string;
  CameraMac: string;
  CenterFp: number[];
  AngleDeg: number;
  Scale: number;
  HLocalCanvas: Matrix3x3;
  LocalCanvasSize: number[];
  GlobalHomographyFloorplan: Matrix3x3;
  GlobalHomography: Matrix3x3;
}

export interface GlobalHomographySetDto {
  ProjectId: string;
  FloorplanId?: string | null;
  MmPerFpPx: number;
  OriginFp: number[];
  FloorplanSize: number[];
  Placements: GlobalHomographyPlacementDto[];
  LockedGroups: HomographyLockGroupDto[];
  SavedAt: string;
  SavedByUserId?: string | null;
}

export interface PuzzleWorkspaceResponseDto {
  ProjectId: string;
  PuzzlePieces: PuzzlePieceDto[];
  PuzzlePieceMetaFiles: PuzzlePieceMetadataDto[];
  LocalHomographies: LocalHomographyWorkspaceDto[];
  GlobalHomographies?: GlobalHomographySetDto | null;
  LockedGroups: HomographyLockGroupDto[];
}

export interface SaveGlobalHomographyPlacementDto {
  PuzzlePieceId: string;
  DeviceId: string;
  CameraMac: string;
  CenterFp: number[];
  AngleDeg: number;
  Scale: number;
  HLocalCanvas: Matrix3x3;
  LocalCanvasSize: number[];
}

export interface SaveGlobalHomographiesDto {
  FloorplanId?: string | null;
  MmPerFpPx: number;
  OriginFp: number[];
  FloorplanSize: number[];
  Placements: SaveGlobalHomographyPlacementDto[];
  LockedGroups?: HomographyLockGroupDto[] | null;
}

export interface SaveGlobalHomographiesResponseDto {
  ProjectId: string;
  PlacementsSaved: number;
  SavedAt: string;
  GlobalHomographies: GlobalHomographySetDto;
}
