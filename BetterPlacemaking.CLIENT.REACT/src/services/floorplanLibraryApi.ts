import { api } from "../auth/apiClient";
import type { FloorplanLibraryItemDto } from "../lib/floorplanTypes";

/**
 * Matches floorplanLibrary.routes.ts's `GET /api/floorplan-library?projectId=...`
 * (FloorplanLibraryController.GetLibrary ported verbatim) - scoped to the calling
 * user's own uploaded floorplans, optionally filtered to one project.
 *
 * uploadFloorplan/deleteFloorplan below round out the resource for Vision.tsx's
 * Floorplan Library panel (upload/update/delete live in floorplanLibrary.routes.ts
 * alongside the read above).
 */
export function getFloorplanLibrary(projectId?: string): Promise<FloorplanLibraryItemDto[]> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return api.get<FloorplanLibraryItemDto[]>(`/api/floorplan-library${query}`);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

/**
 * NOTE: the Angular floorplan-service.ts uploaded via multipart FormData, but this
 * server has no multipart parser - floorplanLibrary.routes.ts's POST /upload instead
 * accepts JSON with a base64-encoded image ({ ImageBase64, FileName, ContentType,
 * Nickname, ProjectId }). This reads the File as a base64 data URL client-side to
 * match that contract exactly.
 */
export async function uploadFloorplan(file: File, nickname: string, projectId: string): Promise<FloorplanLibraryItemDto> {
  const imageBase64 = await fileToBase64(file);
  return api.post<FloorplanLibraryItemDto>("/api/floorplan-library/upload", {
    ImageBase64: imageBase64,
    FileName: file.name,
    ContentType: file.type || undefined,
    Nickname: nickname,
    ProjectId: projectId,
  });
}

export function deleteFloorplan(id: string): Promise<void> {
  return api.delete<void>(`/api/floorplan-library/${id}`);
}
