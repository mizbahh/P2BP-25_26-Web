import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../config/firebase.js";
import type { Scan, ScanDoc, UpdateScanStatusRequest } from "../models/scanDevice.js";

/**
 * Mirrors ScanService.cs's collection path exactly: scans are a subcollection of a
 * per-project "devices" shadow doc (`projects/{projectId}/devices/{deviceId}/scans`),
 * distinct from the top-level `devices` collection deviceService.ts owns. Kept as a
 * direct Firestore access here (not routed through deviceService.ts) for the same
 * reason ScanService.cs talks to Firestore directly instead of going through
 * DeviceService for this subtree.
 */
function scansCollection(projectId: string, deviceId: string) {
  return getDb().collection("projects").doc(projectId).collection("devices").doc(deviceId).collection("scans");
}

function toScan(id: string, data: FirebaseFirestore.DocumentData): Scan {
  return { Id: id, ...(data as ScanDoc) };
}

function createdAtMillis(data: ScanDoc): number {
  const createdAt = data.CreatedAt as FirebaseFirestore.Timestamp | null | undefined;
  return createdAt && typeof createdAt.toMillis === "function" ? createdAt.toMillis() : 0;
}

/** Oldest pending scan for the device, or null if none. Mirrors ScanService.GetNextPendingScanId. */
export async function getNextPendingScanId(projectId: string, deviceId: string): Promise<string | null> {
  const snapshot = await scansCollection(projectId, deviceId).get();

  const pending = snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as ScanDoc }))
    .filter((d) => typeof d.data.Status === "string" && d.data.Status.trim().toLowerCase() === "pending")
    .sort((a, b) => createdAtMillis(a.data) - createdAtMillis(b.data));

  return pending.length > 0 ? pending[0].id : null;
}

/** Mirrors ScanService.GetScan, minus the NormalizeFirestoreValue timestamp->ISO-string pass (not needed by ScanDeviceController's own use of this). */
export async function getScan(projectId: string, deviceId: string, scanId: string): Promise<Scan | null> {
  const doc = await scansCollection(projectId, deviceId).doc(scanId).get();
  if (!doc.exists) return null;
  return toScan(doc.id, doc.data()!);
}

/**
 * Mirrors ScanService.UpdateScanStatus: only the provided fields are written, plus
 * server-assigned StartedAt/FinishedAt transitions.
 *
 * Not ported (out of scope for this resource - both are separate, not-yet-migrated
 * services with no Express equivalent yet):
 *  - ScanCompleteVisualizerIngestService.TryIngestFromScanDocumentAsync (visualizer ingest
 *    pipeline triggered after every status write)
 *  - NotificationService.NotifyScanCompleted (emails project members on Status=complete)
 *  - DeviceService.ClearLidarScanOneShotIfSet (best-effort Config.LidarScan.BeginScanning
 *    clear on Status=running; also not possible without editing deviceService.ts, which is
 *    off-limits here, and the ported Config type in models/device.ts has no LidarScan field
 *    yet). This is a self-healing performance optimization on the old server, not a
 *    correctness requirement - see the comment in ScanService.cs's UpdateScanStatus.
 */
export async function updateScanStatus(
  projectId: string,
  deviceId: string,
  scanId: string,
  body: UpdateScanStatusRequest,
): Promise<boolean> {
  const ref = scansCollection(projectId, deviceId).doc(scanId);
  const existing = await ref.get();
  if (!existing.exists) return false;

  const status = body.Status?.trim();
  const objUrl = body.ObjUrl?.trim();
  const error = body.Error?.trim();

  const updates: Record<string, unknown> = {};
  if (status) updates.Status = status;
  if (objUrl) updates.ObjUrl = objUrl;
  if (error) updates.Error = error;

  if (status && status.toLowerCase() === "running") {
    updates.StartedAt = Timestamp.now();
  }
  if (status && (status.toLowerCase() === "complete" || status.toLowerCase() === "error")) {
    updates.FinishedAt = Timestamp.now();
  }

  if (Object.keys(updates).length === 0) return true;

  await ref.update(updates);
  return true;
}
