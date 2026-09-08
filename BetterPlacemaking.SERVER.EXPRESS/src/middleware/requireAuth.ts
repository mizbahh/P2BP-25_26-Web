import type { NextFunction, Request, Response } from "express";
import { verifyUserToken } from "../services/tokenService.js";

/** Default policy for the whole API, matching the ASP.NET server's UserJwt default policy. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ Message: "Missing bearer token." });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    req.user = verifyUserToken(token);
    next();
  } catch {
    res.status(401).json({ Message: "Invalid or expired token." });
  }
}
