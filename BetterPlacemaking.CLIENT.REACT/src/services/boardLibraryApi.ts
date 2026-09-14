import { api } from "../auth/apiClient";
import type { BoardLibraryItem, SaveBoardLibraryItemRequest } from "../lib/boardLibraryTypes";

/**
 * Ported from the Angular app/services/board-service.ts. Every endpoint is
 * user-scoped (not project-scoped) on the server - matches
 * BetterPlacemaking.SERVER.EXPRESS/src/routes/boardLibrary.routes.ts exactly.
 */

export function getLibrary(): Promise<BoardLibraryItem[]> {
  return api.get<BoardLibraryItem[]>("/api/board-library");
}

export function getBoard(id: string): Promise<BoardLibraryItem> {
  return api.get<BoardLibraryItem>(`/api/board-library/${id}`);
}

export function saveToLibrary(payload: SaveBoardLibraryItemRequest): Promise<BoardLibraryItem> {
  return api.post<BoardLibraryItem>("/api/board-library", payload);
}

export function updateInLibrary(id: string, payload: SaveBoardLibraryItemRequest): Promise<BoardLibraryItem> {
  return api.put<BoardLibraryItem>(`/api/board-library/${id}`, payload);
}

export function deleteFromLibrary(id: string): Promise<void> {
  return api.delete<void>(`/api/board-library/${id}`);
}
