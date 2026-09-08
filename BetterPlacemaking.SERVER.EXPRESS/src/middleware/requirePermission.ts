import type { NextFunction, Request, Response } from "express";
import { parsePermission } from "../authorization/policy.js";
import { hasGlobalPermission, hasProjectPermission } from "../authorization/authorizationService.js";

function resolveProjectId(req: Request): string | undefined {
  // Same fallback order as PermissionAuthorizationHandler.ResolveProjectId.
  return (
    (req.params.projectId as string | undefined) ||
    (req.params.id as string | undefined) ||
    (req.query.projectId as string | undefined) ||
    (req.query.id as string | undefined) ||
    undefined
  );
}

/** Mirrors [RequirePermission(...)] - resolves scope from the Global./Project. prefix. */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ Message: "Authentication required." });
      return;
    }

    const parsed = parsePermission(permission);
    if (!parsed) {
      res.status(500).json({ Message: `Unrecognized permission "${permission}".` });
      return;
    }

    const userId = req.user.sub;

    try {
      let allowed: boolean;
      if (parsed.scope === "Global") {
        allowed = await hasGlobalPermission(userId, req.user.role, parsed.permission);
      } else {
        const projectId = resolveProjectId(req);
        allowed = !!projectId && (await hasProjectPermission(userId, req.user.role, projectId, parsed.permission));
      }

      if (!allowed) {
        res.status(403).json({ Message: "Forbidden." });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
