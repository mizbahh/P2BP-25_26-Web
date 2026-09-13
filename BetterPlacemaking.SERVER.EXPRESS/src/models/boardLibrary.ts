/**
 * Ported from BetterPlacemaking.SERVER/Models/BoardLibraryItem.cs and
 * Models/Dtos/BoardLibraryDtos.cs. A board_library item is a saved
 * ChArUco/ArUco calibration board preset, always scoped to the user who
 * created it (there is no project scoping or sharing for this resource).
 */

import type { Timestamp } from "firebase-admin/firestore";

export type BoardType = "charuco" | "aruco";
export type BoardUnits = "mm" | "cm" | "in";

/** Firestore doc shape for the `board_library` collection - PascalCase, unchanged from the ASP.NET server. */
export interface BoardLibraryDoc {
  UserId: string;
  Type: string;
  Nickname: string;
  Dictionary: string;
  Units: string;
  Cols?: number | null;
  Rows?: number | null;
  MarkerId?: number | null;
  SquareSize?: number | null;
  MarkerSize: number;
  SquareSizeMm?: number | null;
  MarkerSizeMm: number;
  PreviewSvg: string;
  CreatedAtUtc: Timestamp;
}

export interface BoardLibraryItem extends BoardLibraryDoc {
  Id: string;
}

/** Client payload for POST/PUT - mirrors SaveBoardLibraryItemDto. Fields are normalized/validated in the service. */
export interface SaveBoardLibraryItemDto {
  Type?: string;
  Nickname?: string | null;
  Dictionary?: string;
  Units?: string;
  Cols?: number | null;
  Rows?: number | null;
  MarkerId?: number | null;
  SquareSize?: number | null;
  MarkerSize?: number;
  PreviewSvg?: string;
}

/** Wire DTO - mirrors BoardLibraryItemDto; CreatedAtUtc is serialized as an ISO 8601 string. */
export interface BoardLibraryItemDto {
  Id: string;
  Type: string;
  Nickname: string;
  Dictionary: string;
  Units: string;
  Cols?: number | null;
  Rows?: number | null;
  MarkerId?: number | null;
  SquareSize?: number | null;
  MarkerSize: number;
  SquareSizeMm?: number | null;
  MarkerSizeMm: number;
  PreviewSvg: string;
  CreatedAtUtc: string;
}

export function toBoardLibraryItemDto(item: BoardLibraryItem): BoardLibraryItemDto {
  return {
    Id: item.Id,
    Type: item.Type,
    Nickname: item.Nickname,
    Dictionary: item.Dictionary,
    Units: item.Units,
    Cols: item.Cols ?? null,
    Rows: item.Rows ?? null,
    MarkerId: item.MarkerId ?? null,
    SquareSize: item.SquareSize ?? null,
    MarkerSize: item.MarkerSize,
    SquareSizeMm: item.SquareSizeMm ?? null,
    MarkerSizeMm: item.MarkerSizeMm,
    PreviewSvg: item.PreviewSvg,
    CreatedAtUtc: item.CreatedAtUtc.toDate().toISOString(),
  };
}
