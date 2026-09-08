import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { getDb } from "../config/firebase.js";
import type { User, UserDoc, UserSettingsDto } from "../models/types.js";

const COLLECTION = "users";
const BCRYPT_ROUNDS = 10;

function toUser(id: string, data: FirebaseFirestore.DocumentData): User {
  return { Id: id, ...(data as UserDoc) };
}

export async function getUsers(): Promise<User[]> {
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => toUser(doc.id, doc.data()));
}

export async function getUserById(id: string): Promise<User | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toUser(doc.id, doc.data()!);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).where("Email", "==", email).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return toUser(doc.id, doc.data());
}

export interface RegisterInput {
  FirstName?: string;
  LastName?: string;
  Email: string;
  Password: string;
}

/** Returns null if the email is already registered. */
export async function addUser(input: RegisterInput): Promise<User | null> {
  const existing = await getUserByEmail(input.Email);
  if (existing) return null;

  const db = getDb();
  const hashedPassword = await bcrypt.hash(input.Password, BCRYPT_ROUNDS);
  const emailVerificationToken = crypto.randomUUID();

  const doc: UserDoc = {
    FirstName: input.FirstName ?? null,
    LastName: input.LastName ?? null,
    Email: input.Email,
    Password: hashedPassword,
    Role: "User",
    EmailVerified: false,
    EmailVerificationToken: emailVerificationToken,
    PasswordResetToken: null,
    PasswordResetTokenExpiry: null,
  };

  const ref = db.collection(COLLECTION).doc();
  await ref.set(doc);

  return toUser(ref.id, doc as FirebaseFirestore.DocumentData);
}

/** Full-document overwrite, matching the ASP.NET server's SetAsync-based update. */
export async function updateUser(id: string, data: UserDoc): Promise<boolean> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.set(data);
  return true;
}

export async function deleteUser(id: string): Promise<boolean> {
  const db = getDb();
  const ref = db.collection(COLLECTION).doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;
  await ref.delete();
  return true;
}

export async function updatePassword(id: string, hashedPassword: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).update({ Password: hashedPassword });
}

export async function markEmailVerified(id: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(id).update({
    EmailVerified: true,
    EmailVerificationToken: null,
  });
}

export async function getUserByVerificationToken(token: string): Promise<User | null> {
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).where("EmailVerificationToken", "==", token).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return toUser(doc.id, doc.data());
}

export class SettingsValidationError extends Error {}

/** Mirrors UserService.UserSettings: trims names, enforces a 50-char max, no-op if nothing changed. */
export async function updateUserSettings(id: string, settings: UserSettingsDto): Promise<void> {
  const patch: Record<string, unknown> = {};

  if (settings.FirstName != null) {
    const first = settings.FirstName.trim();
    if (first.length > 50) throw new SettingsValidationError("FirstName must be <= 50 characters.");
    if (first.length > 0) patch.FirstName = first;
  }

  if (settings.LastName != null) {
    const last = settings.LastName.trim();
    if (last.length > 50) throw new SettingsValidationError("LastName must be <= 50 characters.");
    patch.LastName = last;
  }

  if (settings.EmailAlerts !== undefined) patch.EmailAlerts = settings.EmailAlerts;

  if (Object.keys(patch).length === 0) return;

  const db = getDb();
  await db.collection(COLLECTION).doc(id).update(patch);
}

export function toPublicSettings(user: User): UserSettingsDto {
  return {
    FirstName: user.FirstName ?? undefined,
    LastName: user.LastName ?? undefined,
    EmailAlerts: user.EmailAlerts ?? undefined,
  };
}
