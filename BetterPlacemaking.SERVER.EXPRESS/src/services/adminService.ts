import { getDb } from "../config/firebase.js";
import * as userService from "./userService.js";

export async function updateRole(targetEmail: string, newRole: string): Promise<boolean> {
  const user = await userService.getUserByEmail(targetEmail);
  if (!user) return false;

  if (user.Role === "Admin") return false; // legacy rule: Admins can't be role-changed via this endpoint
  if (user.Role === newRole) return true;

  const db = getDb();
  await db.collection("users").doc(user.Id).update({ Role: newRole });
  return true;
}
