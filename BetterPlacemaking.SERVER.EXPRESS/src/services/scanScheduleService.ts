import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../config/firebase.js";
import type { ScanSchedule, ScanScheduleDoc } from "../models/scanSchedule.js";

const PROJECTS_COLLECTION = "projects";
const SUBCOLLECTION = "scan_schedules";

function getCollection(projectId: string) {
  return getDb().collection(PROJECTS_COLLECTION).doc(projectId).collection(SUBCOLLECTION);
}

function toScanSchedule(id: string, data: FirebaseFirestore.DocumentData): ScanSchedule {
  return { Id: id, ...(data as ScanScheduleDoc) };
}

export interface ScanScheduleCreateInput {
  StartDate?: string | null;
  StartTime?: string | null;
  Frequency?: string | null;
  EndDate?: string | null;
  EndTime?: string | null;
  LastRunAt?: FirebaseFirestore.Timestamp | null;
}

/** Mirrors ScanScheduleService.CreateSchedule: CreatedAt/CreatedByUserId are always server-assigned, never client-supplied. */
export async function createSchedule(
  projectId: string,
  input: ScanScheduleCreateInput,
  createdByUserId?: string | null,
): Promise<ScanSchedule> {
  const collection = getCollection(projectId);
  const ref = collection.doc();
  const doc: ScanScheduleDoc = {
    StartDate: input.StartDate ?? null,
    StartTime: input.StartTime ?? null,
    Frequency: input.Frequency ?? null,
    EndDate: input.EndDate ?? null,
    EndTime: input.EndTime ?? null,
    CreatedAt: Timestamp.now(),
    CreatedByUserId: createdByUserId ?? null,
    LastRunAt: input.LastRunAt ?? null,
  };
  await ref.set(doc);
  return toScanSchedule(ref.id, doc as FirebaseFirestore.DocumentData);
}

export async function getSchedules(projectId: string): Promise<ScanSchedule[]> {
  const snapshot = await getCollection(projectId).get();
  return snapshot.docs.map((doc) => toScanSchedule(doc.id, doc.data()));
}

export async function deleteSchedule(projectId: string, scheduleId: string): Promise<boolean> {
  const ref = getCollection(projectId).doc(scheduleId);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}

export interface ScanScheduleUpdateInput {
  StartDate?: string | null;
  StartTime?: string | null;
  Frequency?: string | null;
  EndDate?: string | null;
  EndTime?: string | null;
}

/**
 * Mirrors ScanScheduleService.UpdateSchedule's partial-update semantics exactly:
 * StartDate/StartTime/Frequency are only touched when provided (omitting one leaves
 * the stored value unchanged), while EndDate/EndTime are *always* written, defaulting
 * to "" when omitted - ported faithfully even though this asymmetry looks like it lets
 * a caller inadvertently clear an end date/time by leaving it out of the request body.
 */
export async function updateSchedule(
  projectId: string,
  scheduleId: string,
  input: ScanScheduleUpdateInput,
): Promise<boolean> {
  const ref = getCollection(projectId).doc(scheduleId);
  const existing = await ref.get();
  if (!existing.exists) return false;

  const updates: Record<string, unknown> = {};
  if (input.StartDate != null) updates.StartDate = input.StartDate;
  if (input.StartTime != null) updates.StartTime = input.StartTime;
  if (input.Frequency != null) updates.Frequency = input.Frequency;
  updates.EndDate = input.EndDate ?? "";
  updates.EndTime = input.EndTime ?? "";

  await ref.update(updates);
  return true;
}
