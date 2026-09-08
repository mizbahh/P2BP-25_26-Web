import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "../config/firebase.js";
import * as userService from "./userService.js";
import * as emailService from "./emailService.js";

const COLLECTION = "users";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 10;

export async function requestPasswordReset(email: string): Promise<boolean> {
  const user = await userService.getUserByEmail(email);
  if (!user) return false;

  const token = crypto.randomUUID();
  const expiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  const db = getDb();
  await db.collection(COLLECTION).doc(user.Id).update({
    PasswordResetToken: token,
    PasswordResetTokenExpiry: Timestamp.fromDate(expiry),
  });

  await emailService.sendPasswordResetEmail(email, token);
  return true;
}

export class ValidationError extends Error {}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const db = getDb();
  const snapshot = await db.collection(COLLECTION).where("PasswordResetToken", "==", token).limit(1).get();
  if (snapshot.empty) return false;

  const doc = snapshot.docs[0];
  const data = doc.data();
  const expiry = data.PasswordResetTokenExpiry as Timestamp | null | undefined;
  if (!expiry || expiry.toDate().getTime() < Date.now()) return false;

  // Deviation from the ASP.NET server: it didn't enforce a minimum length here even
  // though changePassword does. Enforcing the same rule for consistency (see plan).
  if (!newPassword || newPassword.trim().length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await doc.ref.update({
    Password: hashedPassword,
    PasswordResetToken: null,
    PasswordResetTokenExpiry: null,
  });
  return true;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  if (!currentPassword || !newPassword) {
    throw new ValidationError("Current and new password are required.");
  }
  if (newPassword.trim().length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const user = await userService.getUserById(userId);
  if (!user || !user.Password) {
    throw new ValidationError("User not found.");
  }

  const matches = await bcrypt.compare(currentPassword, user.Password);
  if (!matches) return false;

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await userService.updatePassword(userId, hashedPassword);
  return true;
}
