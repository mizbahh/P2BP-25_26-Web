import { api } from "../auth/apiClient";
import type {
  PuzzlePieceDto,
  PuzzleWorkspaceResponseDto,
  SaveGlobalHomographiesDto,
  SaveGlobalHomographiesResponseDto,
} from "../lib/homographyTypes";

/**
 * Client for the puzzle-workspace subset of
 * BetterPlacemaking.SERVER.EXPRESS/src/routes/homography.routes.ts. Mirrors the Angular
 * HomographyService's calls (same 4 methods below) plus the two additional workspace
 * endpoints the Express server exposes (refreshPuzzlePieces, getPuzzlePiece) that the old
 * Angular HomographyService never called.
 */

export function getPuzzleWorkspace(projectId: string): Promise<PuzzleWorkspaceResponseDto> {
  return api.get<PuzzleWorkspaceResponseDto>(`/api/homography/workspace/${projectId}`);
}

/** Forces regeneration of every puzzle piece in the project (POST .../puzzle-pieces/refresh). */
export function refreshPuzzlePieces(projectId: string): Promise<PuzzleWorkspaceResponseDto> {
  return api.post<PuzzleWorkspaceResponseDto>(`/api/homography/workspace/${projectId}/puzzle-pieces/refresh`);
}

/** Fetches (or, with force, regenerates) a single puzzle piece. Not currently used by Puzzle.tsx - the
 * full workspace fetch already returns every piece - exposed here for parity with the backend route. */
export function getPuzzlePiece(
  projectId: string,
  deviceId: string,
  cameraMac: string,
  force = false,
): Promise<PuzzlePieceDto> {
  const query = force ? "?force=true" : "";
  return api.get<PuzzlePieceDto>(
    `/api/homography/workspace/${projectId}/puzzle-pieces/${deviceId}/${cameraMac}${query}`,
  );
}

export function saveGlobalHomographies(
  projectId: string,
  payload: SaveGlobalHomographiesDto,
): Promise<SaveGlobalHomographiesResponseDto> {
  return api.post<SaveGlobalHomographiesResponseDto>(
    `/api/homography/workspace/${projectId}/global-homographies`,
    payload,
  );
}

export async function hasLocalHomography(deviceId: string): Promise<boolean> {
  const response = await api.get<{ HasLocalHomography: boolean }>(`/api/homography/has-local/${deviceId}`);
  return response.HasLocalHomography;
}

export async function getSnapshotUrl(deviceId: string, cameraMac: string): Promise<string | null> {
  const response = await api.get<{ SnapshotUrl: string | null }>(
    `/api/homography/snapshot-url/${deviceId}/${cameraMac}`,
  );
  return response.SnapshotUrl ?? null;
}
