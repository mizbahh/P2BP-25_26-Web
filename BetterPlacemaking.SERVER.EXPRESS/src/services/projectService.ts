import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../config/firebase.js";
import type { Project, ProjectDoc } from "../models/project.js";

const COLLECTION = "projects";

function toProject(id: string, data: FirebaseFirestore.DocumentData): Project {
  return { Id: id, ...(data as ProjectDoc) };
}

export async function getAll(): Promise<Project[]> {
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => toProject(doc.id, doc.data()));
}

export async function getById(id: string): Promise<Project | null> {
  if (!id) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toProject(doc.id, doc.data()!);
}

export interface CreateProjectInput {
  Title?: string | null;
  Description?: string | null;
  Location?: string | null;
}

/**
 * Creates the project and, as a fix over the ASP.NET server (see migration plan),
 * bootstraps the creator's membership so they aren't immediately locked out of a
 * project they just made - writes the same member-doc shape roleAssignmentService
 * already uses (roles/authzVersion/updatedAt) with the seeded ProjectOwner role.
 */
export async function create(input: CreateProjectInput, creatorUserId: string): Promise<Project> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc();
  const doc: ProjectDoc = {
    Title: input.Title ?? null,
    Description: input.Description ?? null,
    Location: input.Location ?? null,
  };

  const memberRef = ref.collection("members").doc(creatorUserId);

  await db.runTransaction(async (tx) => {
    tx.set(ref, doc);
    tx.set(memberRef, {
      roles: ["ProjectOwner"],
      authzVersion: 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return toProject(ref.id, doc as FirebaseFirestore.DocumentData);
}

/** Full-field overwrite of Title/Description/Location every call - matches the ASP.NET server (not a partial PATCH). */
export async function update(id: string, input: CreateProjectInput): Promise<boolean> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;

  await ref.update({
    Title: input.Title ?? null,
    Description: input.Description ?? null,
    Location: input.Location ?? null,
  });
  return true;
}

/** Single-doc delete, no cascading cleanup of members/devices - matches the ASP.NET server. */
export async function deleteProject(id: string): Promise<boolean> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}
