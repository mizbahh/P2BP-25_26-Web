import type { NextFunction, Request, Response } from "express";

/** Legacy role-claim check, matching [Authorize(Roles = "Admin")] on AdminController. */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ Message: "Authentication required." });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({ Message: "Forbidden." });
      return;
    }
    next();
  };
}
