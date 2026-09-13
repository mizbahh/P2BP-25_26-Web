import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getDb } from "../config/firebase.js";
import type { Device, DeviceDoc } from "../models/device.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      device?: Device;
    }
  }
}

export function computeApiKeyHash(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("base64");
}

/**
 * Mirrors DeviceApiKeyAuthenticationHandler / the "DeviceApiKey" auth policy -
 * authenticates a device via `Authorization: Bearer <raw api key>`, matched
 * against the stored ApiKeyHash (see deviceService.generateAndUpdateApiKey).
 * The distributed-cache layer in front of this lookup in the ASP.NET
 * DeviceService is not ported - every request does a direct Firestore query,
 * same as every other resource ported so far.
 */
export async function requireDeviceApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ Message: "Missing device API key." });
    return;
  }

  const apiKey = header.slice("Bearer ".length).trim();
  if (!apiKey) {
    res.status(401).json({ Message: "Missing device API key." });
    return;
  }

  try {
    const db = getDb();
    const hash = computeApiKeyHash(apiKey);
    const snapshot = await db.collection("devices").where("ApiKeyHash", "==", hash).limit(1).get();
    if (snapshot.empty) {
      res.status(401).json({ Message: "Invalid device API key." });
      return;
    }

    const doc = snapshot.docs[0];
    req.device = { Id: doc.id, ...(doc.data() as DeviceDoc) };
    next();
  } catch (err) {
    next(err);
  }
}
