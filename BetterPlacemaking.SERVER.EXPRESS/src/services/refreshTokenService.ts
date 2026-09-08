import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../config/firebase.js";
import { env, refreshTokenHashKey } from "../config/env.js";
import type { RefreshTokenRecord } from "../models/types.js";

const COLLECTION = "refreshTokens";

function generateToken(): string {
  return crypto.randomBytes(64).toString("base64url");
}

function computeTokenHash(token: string): string {
  return crypto.createHmac("sha256", refreshTokenHashKey()).update(token).digest("base64");
}

export interface IssuedRefreshToken {
  token: string;
  expiresAtUtc: Date;
  id: string;
}

/** Issues a brand new refresh token (used at login, and as half of rotation). */
export async function issue(userId: string, userAgent: string | undefined): Promise<IssuedRefreshToken> {
  const db = getDb();
  const token = generateToken();
  const now = new Date();
  const expiresAtUtc = new Date(now.getTime() + env.authRefreshTokenDays * 24 * 60 * 60 * 1000);

  const ref = db.collection(COLLECTION).doc();
  await ref.set({
    UserId: userId,
    TokenHash: computeTokenHash(token),
    CreatedAtUtc: Timestamp.fromDate(now),
    ExpiresAtUtc: Timestamp.fromDate(expiresAtUtc),
    RevokedAtUtc: null,
    ReplacedByTokenId: null,
    UserAgent: userAgent ?? null,
  });

  return { token, expiresAtUtc, id: ref.id };
}

/** Looks up an active (not revoked, not expired) refresh token record by its raw token value. */
export async function findActive(token: string): Promise<RefreshTokenRecord | null> {
  const db = getDb();
  const hash = computeTokenHash(token);
  const snapshot = await db.collection(COLLECTION).where("TokenHash", "==", hash).limit(1).get();
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data();
  if (data.RevokedAtUtc) return null;

  const expiresAtUtc = (data.ExpiresAtUtc as Timestamp).toDate();
  if (expiresAtUtc.getTime() <= Date.now()) return null;

  return { Id: doc.id, ...data } as RefreshTokenRecord;
}

export async function revoke(tokenId: string, replacedByTokenId?: string): Promise<void> {
  const db = getDb();
  await db.collection(COLLECTION).doc(tokenId).update({
    RevokedAtUtc: Timestamp.now(),
    ReplacedByTokenId: replacedByTokenId ?? null,
  });
}

/**
 * Atomically issues a new refresh token and revokes the old one in a single
 * Firestore transaction (the ASP.NET server does these as two separate calls;
 * this closes that race window per the migration plan's deviation #4).
 */
export async function rotate(oldRecord: RefreshTokenRecord, userAgent: string | undefined): Promise<IssuedRefreshToken> {
  const db = getDb();
  const token = generateToken();
  const now = new Date();
  const expiresAtUtc = new Date(now.getTime() + env.authRefreshTokenDays * 24 * 60 * 60 * 1000);
  const newRef = db.collection(COLLECTION).doc();
  const oldRef = db.collection(COLLECTION).doc(oldRecord.Id);

  await db.runTransaction(async (tx) => {
    tx.set(newRef, {
      UserId: oldRecord.UserId,
      TokenHash: computeTokenHash(token),
      CreatedAtUtc: Timestamp.fromDate(now),
      ExpiresAtUtc: Timestamp.fromDate(expiresAtUtc),
      RevokedAtUtc: null,
      ReplacedByTokenId: null,
      UserAgent: userAgent ?? null,
    });
    tx.update(oldRef, {
      RevokedAtUtc: Timestamp.fromDate(now),
      ReplacedByTokenId: newRef.id,
    });
  });

  return { token, expiresAtUtc, id: newRef.id };
}
