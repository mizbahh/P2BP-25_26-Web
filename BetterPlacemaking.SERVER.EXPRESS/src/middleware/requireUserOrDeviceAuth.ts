import type { NextFunction, Request, Response } from "express";
import { getDb } from "../config/firebase.js";
import type { DeviceDoc } from "../models/device.js";
import { verifyUserToken } from "../services/tokenService.js";
import { computeApiKeyHash } from "./requireDeviceApiKey.js";

/**
 * Matches CloudStorageController: [Authorize(AuthenticationSchemes = "UserJwt,DeviceApiKey")] -
 * accepts either a user JWT or a device API key in the same `Authorization: Bearer` header, so
 * both logged-in users and Jetson devices can request their own signed GCS URLs. Tries the
 * (cheap, local) JWT verification first and only falls back to a Firestore device-key lookup
 * if that fails, rather than picking a scheme up front - same "try both" semantics ASP.NET's
 * multi-scheme [Authorize] gives you.
 */
export async function requireUserOrDeviceAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ Message: "Missing bearer token." });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ Message: "Missing bearer token." });
    return;
  }

  try {
    req.user = verifyUserToken(token);
    next();
    return;
  } catch {
    // Not a valid user JWT - fall through and try it as a device API key.
  }

  try {
    const db = getDb();
    const hash = computeApiKeyHash(token);
    const snapshot = await db.collection("devices").where("ApiKeyHash", "==", hash).limit(1).get();
    if (snapshot.empty) {
      res.status(401).json({ Message: "Invalid or expired token." });
      return;
    }

    const doc = snapshot.docs[0];
    req.device = { Id: doc.id, ...(doc.data() as DeviceDoc) };
    next();
  } catch (err) {
    next(err);
  }
}
