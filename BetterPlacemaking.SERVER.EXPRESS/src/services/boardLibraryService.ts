import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../config/firebase.js";
import type {
  BoardLibraryDoc,
  BoardLibraryItem,
  BoardType,
  BoardUnits,
  SaveBoardLibraryItemDto,
} from "../models/boardLibrary.js";

const COLLECTION = "board_library";

/** Ported verbatim from BoardLibraryService.DictionaryMaxMarkerId. */
const DICTIONARY_MAX_MARKER_ID: Record<string, number> = {
  DICT_4X4_50: 49,
  DICT_4X4_100: 99,
  DICT_5X5_50: 49,
  DICT_5X5_100: 99,
  DICT_6X6_50: 49,
  DICT_6X6_100: 99,
};

/** Mirrors the ArgumentException thrown by BoardLibraryService's validation helpers; routes map this to 400. */
export class BoardLibraryValidationError extends Error {}

function toItem(id: string, data: FirebaseFirestore.DocumentData): BoardLibraryItem {
  return { Id: id, ...(data as BoardLibraryDoc) };
}

export async function listForUser(userId: string): Promise<BoardLibraryItem[]> {
  if (!userId?.trim()) return [];
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).where("UserId", "==", userId).get();
  return snapshot.docs
    .map((doc) => toItem(doc.id, doc.data()))
    .sort((a, b) => b.CreatedAtUtc.toMillis() - a.CreatedAtUtc.toMillis());
}

export async function getByIdForUser(userId: string, id: string): Promise<BoardLibraryItem | null> {
  if (!userId?.trim() || !id?.trim()) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;

  const item = toItem(doc.id, doc.data()!);
  if (item.UserId !== userId) return null;
  return item;
}

export async function saveForUser(userId: string, dto: SaveBoardLibraryItemDto): Promise<BoardLibraryItem> {
  if (!userId?.trim()) throw new BoardLibraryValidationError("Missing user id.");

  const db = getDb();
  const ref = db.collection(COLLECTION).doc();
  const doc = buildValidatedItem(userId, dto, Timestamp.now());
  await ref.set(doc);
  return toItem(ref.id, doc as FirebaseFirestore.DocumentData);
}

/** Returns null when the board doesn't exist or belongs to a different user - routes map that to 404. */
export async function updateForUser(
  userId: string,
  id: string,
  dto: SaveBoardLibraryItemDto,
): Promise<BoardLibraryItem | null> {
  if (!userId?.trim()) throw new BoardLibraryValidationError("Missing user id.");
  if (!id?.trim()) throw new BoardLibraryValidationError("id is required.");

  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const existingSnap = await ref.get();
  if (!existingSnap.exists) return null;

  const existing = toItem(id, existingSnap.data()!);
  if (existing.UserId !== userId) return null;

  const doc = buildValidatedItem(userId, dto, existing.CreatedAtUtc);
  await ref.set(doc);
  return toItem(id, doc as FirebaseFirestore.DocumentData);
}

export async function deleteForUser(userId: string, id: string): Promise<boolean> {
  if (!userId?.trim() || !id?.trim()) return false;

  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const existingSnap = await ref.get();
  if (!existingSnap.exists) return false;

  const existing = toItem(id, existingSnap.data()!);
  if (existing.UserId !== userId) return false;

  await ref.delete();
  return true;
}

/** Ported from BoardLibraryService.BuildValidatedItem - normalizes/validates the whole payload, throwing BoardLibraryValidationError on failure. */
function buildValidatedItem(userId: string, dto: SaveBoardLibraryItemDto, createdAtUtc: Timestamp): BoardLibraryDoc {
  const type = normalizeBoardType(dto.Type);
  const dictionary = normalizeDictionary(dto.Dictionary);
  const units = normalizeUnits(dto.Units);
  const nickname = normalizeNickname(dto.Nickname, type);
  const previewSvg = normalizePreviewSvg(dto.PreviewSvg);
  const markerSize = dto.MarkerSize ?? 0;

  validateDimensions(type, dictionary, dto.Cols, dto.Rows, dto.MarkerId, dto.SquareSize, markerSize);

  const markerSizeMm = convertToMm(markerSize, units);
  const squareSizeMm = type === "charuco" && dto.SquareSize != null ? convertToMm(dto.SquareSize, units) : null;

  return {
    UserId: userId,
    Type: type,
    Nickname: nickname,
    Dictionary: dictionary,
    Units: units,
    Cols: type === "charuco" ? dto.Cols ?? null : null,
    Rows: type === "charuco" ? dto.Rows ?? null : null,
    MarkerId: type === "aruco" ? dto.MarkerId ?? null : null,
    SquareSize: type === "charuco" ? dto.SquareSize ?? null : null,
    MarkerSize: markerSize,
    SquareSizeMm: squareSizeMm,
    MarkerSizeMm: markerSizeMm,
    PreviewSvg: previewSvg,
    CreatedAtUtc: createdAtUtc,
  };
}

function normalizeBoardType(raw: string | undefined): BoardType {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "charuco" || normalized === "aruco") return normalized;
  throw new BoardLibraryValidationError("Type must be 'charuco' or 'aruco'.");
}

function normalizeDictionary(raw: string | undefined): string {
  const normalized = (raw ?? "").trim().toUpperCase();
  if (Object.prototype.hasOwnProperty.call(DICTIONARY_MAX_MARKER_ID, normalized)) return normalized;
  throw new BoardLibraryValidationError("Unsupported dictionary.");
}

function normalizeUnits(raw: string | undefined): BoardUnits {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (normalized === "mm" || normalized === "cm" || normalized === "in") return normalized;
  throw new BoardLibraryValidationError("Units must be mm, cm, or in.");
}

function normalizeNickname(raw: string | null | undefined, type: BoardType): string {
  let cleaned = (raw ?? "").trim();
  if (cleaned.length > 120) cleaned = cleaned.slice(0, 120).trim();
  if (cleaned) return cleaned;

  const prettyType = type === "charuco" ? "ChArUco" : "ArUco";
  // yyyy-MM-dd HH:mm in UTC, matching DateTime.UtcNow's ToString format on the ASP.NET server.
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  return `${prettyType} Board ${stamp}`;
}

function normalizePreviewSvg(raw: string | undefined): string {
  const cleaned = (raw ?? "").trim();
  if (!cleaned) throw new BoardLibraryValidationError("PreviewSvg is required.");
  if (!cleaned.toLowerCase().startsWith("<svg")) {
    throw new BoardLibraryValidationError("PreviewSvg must be an SVG document.");
  }
  if (cleaned.length > 900_000) throw new BoardLibraryValidationError("PreviewSvg is too large.");
  return cleaned;
}

function validateDimensions(
  type: BoardType,
  dictionary: string,
  cols: number | null | undefined,
  rows: number | null | undefined,
  markerId: number | null | undefined,
  squareSize: number | null | undefined,
  markerSize: number,
): void {
  if (markerSize <= 0) throw new BoardLibraryValidationError("MarkerSize must be greater than 0.");

  if (type === "charuco") {
    if (cols == null || cols < 2) {
      throw new BoardLibraryValidationError("Cols must be at least 2 for ChArUco boards.");
    }
    if (rows == null || rows < 2) {
      throw new BoardLibraryValidationError("Rows must be at least 2 for ChArUco boards.");
    }
    if (squareSize == null || squareSize <= 0) {
      throw new BoardLibraryValidationError("SquareSize must be greater than 0 for ChArUco boards.");
    }
    if (markerSize >= squareSize) {
      throw new BoardLibraryValidationError("MarkerSize must be smaller than SquareSize for ChArUco boards.");
    }
    return;
  }

  if (markerId == null) throw new BoardLibraryValidationError("MarkerId is required for ArUco markers.");

  const maxId = DICTIONARY_MAX_MARKER_ID[dictionary];
  if (markerId < 0 || markerId > maxId) {
    throw new BoardLibraryValidationError(`MarkerId must be between 0 and ${maxId} for ${dictionary}.`);
  }
}

function convertToMm(value: number, units: BoardUnits): number {
  switch (units) {
    case "mm":
      return value;
    case "cm":
      return value * 10;
    case "in":
      return value * 25.4;
  }
}
