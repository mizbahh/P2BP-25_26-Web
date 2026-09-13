import crypto from "node:crypto";
import { getDb } from "../config/firebase.js";
import {
  flattenCameraMatrix,
  hasCameraMatrix,
  toIntrinsicsResultDto,
  type CameraIntrinsics,
  type CameraIntrinsicsDoc,
  type IntrinsicsResultResponseDto,
  type IntrinsicsSightingDoc,
  type IntrinsicsSightingsResponseDto,
  type SubmitIntrinsicsResultDto,
  type SubmitIntrinsicsSightingsDto,
} from "../models/intrinsics.js";

const COL_SIGHTINGS = "intrinsics_sightings";
const COL_INTRINSICS = "camera_intrinsics";

function toCameraIntrinsics(id: string, data: FirebaseFirestore.DocumentData): CameraIntrinsics {
  return { Id: id, ...(data as CameraIntrinsicsDoc) };
}

function normalizeMac(mac?: string | null): string {
  return (mac ?? "").trim().toLowerCase();
}

/**
 * Mirrors IntrinsicsService.SubmitSightings: one document per sighting, written
 * together via a transaction (the Firestore-batch-write equivalent that
 * FakeFirestore/the rest of this codebase already uses, see projectService.create).
 */
export async function submitSightings(
  deviceId: string,
  dto: SubmitIntrinsicsSightingsDto,
): Promise<IntrinsicsSightingsResponseDto> {
  const mac = normalizeMac(dto.CameraMac);
  const db = getDb();
  const collection = db.collection(COL_SIGHTINGS);

  const writes = (dto.Sightings ?? []).map((s) => {
    const sanitizedCapturedAt = (s.CapturedAt ?? "").replace(/:/g, "-").replace(/\+/g, "p");
    const docId = `${deviceId}_${mac}_${sanitizedCapturedAt}_${crypto.randomUUID().replace(/-/g, "")}`;
    const doc: IntrinsicsSightingDoc = {
      ModelId: dto.IsPerUnit ? null : (dto.ModelId ?? null),
      DeviceId: deviceId,
      CameraMac: mac,
      IsPerUnit: dto.IsPerUnit,
      CapturedAt: s.CapturedAt ?? null,
      ImagePoints: s.ImagePoints ?? null,
      CornerIds: s.CornerIds ?? null,
      FrameSize: s.FrameSize ?? null,
      Rmse: s.Rmse,
    };
    return { ref: collection.doc(docId), doc };
  });

  await db.runTransaction(async (tx) => {
    for (const { ref, doc } of writes) {
      tx.set(ref, doc);
    }
  });

  return { SightingsStored: writes.length };
}

/** Mirrors IntrinsicsService.StoreResult - doc id is per-unit ("{deviceId}_{mac}") or model-level (ModelId, falling back to mac). */
export async function storeResult(
  deviceId: string,
  dto: SubmitIntrinsicsResultDto,
): Promise<IntrinsicsResultResponseDto> {
  const mac = normalizeMac(dto.CameraMac);
  const docId = dto.IsPerUnit ? `${deviceId}_${mac}` : (dto.ModelId ?? mac);

  const db = getDb();
  const ref = db.collection(COL_INTRINSICS).doc(docId);
  const doc: CameraIntrinsicsDoc = {
    ModelId: dto.IsPerUnit ? null : (dto.ModelId ?? null),
    DeviceId: dto.IsPerUnit ? deviceId : null,
    CameraMac: dto.IsPerUnit ? mac : null,
    IsPerUnit: dto.IsPerUnit,
    CameraMatrixFlat: flattenCameraMatrix(dto.CameraMatrix ?? []),
    DistortionCoefficients: dto.DistortionCoefficients ?? [],
    ReprojectionError: dto.ReprojectionError,
    SightingsUsed: dto.SightingsUsed,
    ComputedAtUnix: Math.floor(Date.now() / 1000),
  };

  await ref.set(doc);
  return toIntrinsicsResultDto(toCameraIntrinsics(docId, doc as FirebaseFirestore.DocumentData));
}

/** Mirrors IntrinsicsService.GetIntrinsics - the per-unit record takes priority, falling back to the model-level one. */
export async function getIntrinsics(
  deviceId: string,
  mac: string,
  modelId?: string | null,
): Promise<IntrinsicsResultResponseDto | null> {
  const normMac = normalizeMac(mac);
  const perUnitId = `${deviceId}_${normMac}`;
  const perUnitDoc = await getDb().collection(COL_INTRINSICS).doc(perUnitId).get();
  if (perUnitDoc.exists) {
    const record = toCameraIntrinsics(perUnitDoc.id, perUnitDoc.data()!);
    if (hasCameraMatrix(record)) {
      return toIntrinsicsResultDto(record);
    }
  }

  if (modelId?.trim()) {
    return getModelIntrinsics(modelId);
  }

  return null;
}

/** Mirrors IntrinsicsService.GetModelIntrinsics. */
export async function getModelIntrinsics(modelId: string): Promise<IntrinsicsResultResponseDto | null> {
  const doc = await getDb().collection(COL_INTRINSICS).doc(modelId).get();
  if (!doc.exists) return null;

  const record = toCameraIntrinsics(doc.id, doc.data()!);
  if (!hasCameraMatrix(record)) return null;

  return toIntrinsicsResultDto(record);
}
