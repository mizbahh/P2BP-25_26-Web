import { Router } from "express";
import * as userService from "../services/userService.js";
import * as roleAssignmentService from "../services/roleAssignmentService.js";
import * as authorizationService from "../authorization/authorizationService.js";
import { Permissions } from "../authorization/permissions.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { toPublicUser } from "../models/types.js";

export const userRouter = Router();

userRouter.use(requireAuth);

function currentUserId(req: import("express").Request): string | undefined {
  return req.user?.sub;
}

// --- self-service ("me") routes - must be registered before the generic /:id route ---

userRouter.get("/me/settings", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    const user = await userService.getUserById(userId);
    if (!user) {
      res.status(404).send();
      return;
    }
    res.status(200).json(userService.toPublicSettings(user));
  } catch (err) {
    next(err);
  }
});

userRouter.patch("/me/settings", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    await userService.updateUserSettings(userId, req.body ?? {});
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

userRouter.get("/me/permissions", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    const permissions = await authorizationService.getEffectiveGlobalPermissions(userId);
    res.status(200).json(permissions);
  } catch (err) {
    next(err);
  }
});

userRouter.get("/me/permissions/:projectId", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    if (!req.params.projectId) {
      res.status(400).send();
      return;
    }
    const permissions = await authorizationService.getEffectiveProjectPermissions(userId, req.params.projectId);
    res.status(200).json(permissions);
  } catch (err) {
    next(err);
  }
});

userRouter.patch("/me/projects/:projectId/notifications", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    const success = await roleAssignmentService.updateProjectNotificationPrefs(
      userId,
      req.params.projectId,
      req.body ?? {},
    );
    res.status(success ? 204 : 404).send();
  } catch (err) {
    next(err);
  }
});

// --- project-role administration ---

userRouter.get("/project-roles/options", async (_req, res, next) => {
  try {
    res.status(200).json(await authorizationService.getProjectRoleOptions());
  } catch (err) {
    next(err);
  }
});

userRouter.get("/project-roles", async (_req, res, next) => {
  try {
    res.status(200).json(await roleAssignmentService.getProjectRoleAssignments());
  } catch (err) {
    next(err);
  }
});

userRouter.put(
  "/project-roles",
  requirePermission(Permissions.Global.UsersManageGlobalRoles),
  async (req, res, next) => {
    try {
      if (!req.body?.UserId) {
        res.status(400).send("UserId is required.");
        return;
      }
      const success = await roleAssignmentService.setUserProjectRoleAssignments(req.body);
      res.status(success ? 204 : 404).send();
    } catch (err) {
      next(err);
    }
  },
);

userRouter.get("/project-roles/project/:projectId", async (req, res, next) => {
  try {
    res.status(200).json(await roleAssignmentService.getProjectMemberRoles(req.params.projectId));
  } catch (err) {
    next(err);
  }
});

userRouter.put(
  "/project-roles/project/:projectId",
  requirePermission(Permissions.Project.MembersAssignEditorViewer),
  async (req, res, next) => {
    try {
      if (!req.body?.UserId) {
        res.status(400).send("UserId is required.");
        return;
      }
      const success = await roleAssignmentService.setProjectMemberRole(req.params.projectId, req.body);
      res.status(success ? 204 : 404).send();
    } catch (err) {
      next(err);
    }
  },
);

// --- plain user CRUD ---

userRouter.get("/", async (_req, res, next) => {
  try {
    const users = await userService.getUsers();
    res.status(200).json(users.map(toPublicUser));
  } catch (err) {
    next(err);
  }
});

userRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      res.status(404).send();
      return;
    }
    res.status(200).json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
});

userRouter.post("/", async (req, res, next) => {
  try {
    const { FirstName, LastName, Email, Password } = req.body ?? {};
    if (!Email || !Password) {
      res.status(400).send("Email and password are required.");
      return;
    }
    const user = await userService.addUser({ FirstName, LastName, Email, Password });
    if (!user) {
      res.status(400).send("Email already exists");
      return;
    }
    res.status(201).json(toPublicUser(user));
  } catch (err) {
    next(err);
  }
});

userRouter.put("/:id", async (req, res, next) => {
  try {
    if (req.body?.Id && req.body.Id !== req.params.id) {
      res.status(400).send("Id mismatch.");
      return;
    }
    const success = await userService.updateUser(req.params.id, req.body ?? {});
    if (!success) {
      res.status(404).send();
      return;
    }
    const updated = await userService.getUserById(req.params.id);
    res.status(200).json(updated ? toPublicUser(updated) : null);
  } catch (err) {
    next(err);
  }
});

userRouter.delete("/:id", async (req, res, next) => {
  try {
    const success = await userService.deleteUser(req.params.id);
    res.status(success ? 204 : 404).send();
  } catch (err) {
    next(err);
  }
});
