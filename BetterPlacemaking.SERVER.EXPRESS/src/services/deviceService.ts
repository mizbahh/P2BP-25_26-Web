import crypto from "node:crypto";
import { getDb } from "../config/firebase.js";
import type { Device, DeviceDoc } from "../models/device.js";

const COLLECTION = "devices";

function toDevice(id: string, data: FirebaseFirestore.DocumentData): Device {
  return { Id: id, ...(data as DeviceDoc) };
}

export async function getDevices(): Promise<Device[]> {
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => toDevice(doc.id, doc.data()));
}

export async function getDevicesByProjectId(projectId: string): Promise<Device[]> {
  if (!projectId?.trim()) return [];
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).where("ProjectId", "==", projectId).get();
  return snapshot.docs.map((doc) => toDevice(doc.id, doc.data()));
}

export async function getDevice(id: string): Promise<Device | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toDevice(doc.id, doc.data()!);
}

export interface DeviceInput {
  ProjectId?: string | null;
  Name?: string | null;
  Config?: Device["Config"];
}

/**
 * Fix over the ASP.NET server (see migration plan): always assigns a fresh
 * server-generated id, ignoring any Id the client might send in the create
 * payload - closes the overwrite/clobber bug where a client-supplied Id could
 * silently replace another device's document.
 */
export async function addDevice(input: DeviceInput): Promise<Device> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc();
  const doc: DeviceDoc = {
    ProjectId: input.ProjectId ?? null,
    Name: input.Name ?? null,
    Config: input.Config ?? null,
    HealthReport: null,
    ApiKeyHash: null,
  };
  await ref.set(doc);
  return toDevice(ref.id, doc as FirebaseFirestore.DocumentData);
}

/** Preserves ApiKeyHash and HealthReport regardless of the incoming payload - neither is client-writable here. */
export async function updateDevice(id: string, input: DeviceInput): Promise<Device | null> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return null;

  const existingData = existing.data() as DeviceDoc;
  const doc: DeviceDoc = {
    ProjectId: input.ProjectId ?? null,
    Name: input.Name ?? null,
    Config: input.Config ?? null,
    HealthReport: existingData.HealthReport ?? null,
    ApiKeyHash: existingData.ApiKeyHash ?? null,
  };
  await ref.set(doc);
  return toDevice(id, doc as FirebaseFirestore.DocumentData);
}

export async function deleteDevice(id: string): Promise<boolean> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}

function computeApiKeyHash(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("base64");
}

/** Generates and persists a new API key hash; the raw key is returned exactly once and never stored. */
export async function generateAndUpdateApiKey(id: string): Promise<string | null> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return null;

  const rawKey = crypto.randomBytes(32).toString("base64");
  const hash = computeApiKeyHash(rawKey);
  await ref.update({ ApiKeyHash: hash });
  return rawKey;
}
