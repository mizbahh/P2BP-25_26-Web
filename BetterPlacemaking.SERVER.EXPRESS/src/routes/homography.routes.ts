import { Router } from "express";
import * as homographyService from "../services/homographyService.js";
import {
  HomographyLockError,
  HomographyNotFoundError,
  HomographyValidationError,
} from "../services/homographyService.js";
import { Permissions } from "../authorization/permissions.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireDeviceApiKey } from "../middleware/requireDeviceApiKey.js";
import { requirePermission } from "../middleware/requirePermission.js";
import type {
  SaveGlobalHomographiesDto,
  SubmitArucoSightingsDto,
  SubmitLocalHomographyDto,
} from "../models/homography.js";

/**
 * Ported from BetterPlacemaking.SERVER/Controllers/HomographyController.cs (old route
 * `api/[controller]` = `api/Homography`; mounted here at `/api/homography`).
 *
 * Like IntrinsicsController, this controller mixes auth policies per-action: the two
 * `submit-*` endpoints are called by Jetson devices under the DeviceApiKey policy, and
 * everything else is called by the client app under UserJwt - so auth is applied per-route
 * rather than once via `router.use(...)`.
 *
 * Error mapping mirrors each action's own catch blocks. homographyService.ts models the
 * three C# exception types the controller distinguishes as classes:
 *   ArgumentException        -> HomographyValidationError -> 400
 *   KeyNotFoundException     -> HomographyNotFoundError   -> 404
 *   InvalidOperationException-> HomographyLockError       -> 422 (compute-lock only)
 * An action that does not catch a given type in C# falls through to `Problem()` (500);
 * here that is `next(err)` reaching errorHandler.ts, which also returns 500.
 */
export const homographyRouter = Router();

// Matches HomographyController.SubmitLocal.
homographyRouter.post("/submit-local", requireDeviceApiKey, async (req, res, next) => {
  try {
    // The old action's guard is `dto == null`, but express.json() can never hand us null
    // for a JSON request - an absent body arrives as {}. The equivalent 400 on the old
    // server comes one step earlier, from [ApiController]'s automatic model validation:
    // SubmitLocalHomographyDto is a positional record whose CameraMac/Matrix members are
    // non-nullable under <Nullable>enable</Nullable>, so they are implicitly [Required]
    // and a body missing them is rejected with 400 before the action body runs. Checking
    // shape here reproduces that, and matches intrinsics.routes.ts's sibling guard.
    const dto = req.body as SubmitLocalHomographyDto | undefined;
    if (!dto || typeof dto !== "object" || typeof dto.CameraMac !== "string" || !Array.isArray(dto.Matrix)) {
      res.status(400).send("Invalid payload.");
      return;
    }

    const deviceId = req.device?.Id;
    if (!deviceId) {
      res.status(401).send("Invalid API key.");
      return;
    }

    const response = await homographyService.submitLocalHomography(deviceId, dto);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Matches HomographyController.SubmitSightings.
homographyRouter.post("/submit-sightings", requireDeviceApiKey, async (req, res, next) => {
  try {
    // Same reasoning as submit-local above: shape check stands in for [ApiController]'s
    // implicit-[Required] model validation on the non-nullable record members.
    const dto = req.body as SubmitArucoSightingsDto | undefined;
    if (!dto || typeof dto !== "object" || typeof dto.CameraMac !== "string" || !Array.isArray(dto.Markers)) {
      res.status(400).send("Invalid payload.");
      return;
    }

    const deviceId = req.device?.Id;
    if (!deviceId) {
      res.status(401).send("Invalid API key.");
      return;
    }

    const response = await homographyService.submitArucoSightings(deviceId, dto);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Matches HomographyController.ComputeLock - the only action that maps
// InvalidOperationException to 422 UnprocessableEntity.
homographyRouter.post("/compute-lock", requireAuth, async (_req, res, next) => {
  try {
    const response = await homographyService.computeLock();
    res.status(200).json(response);
  } catch (err) {
    if (err instanceof HomographyLockError) {
      res.status(422).send(err.message);
      return;
    }
    next(err);
  }
});

// Matches HomographyController.GetIntrinsics.
homographyRouter.get("/intrinsics/:deviceId/:mac", requireAuth, async (req, res, next) => {
  try {
    const { deviceId, mac } = req.params;
    if (!deviceId?.trim() || !mac?.trim()) {
      res.status(400).send("deviceId and mac are required.");
      return;
    }

    const response = await homographyService.getIntrinsics(deviceId, mac);
    if (!response) {
      res.status(404).send("No intrinsics found for the given device and camera.");
      return;
    }
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Matches HomographyController.GetSessionStatus.
homographyRouter.get("/session-status/:sessionId", requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId?.trim()) {
      res.status(400).send("sessionId is required.");
      return;
    }

    const response = await homographyService.getSessionStatus(sessionId);
    res.status(200).json(response);
  } catch (err) {
    if (err instanceof HomographyNotFoundError) {
      res.status(404).send(err.message);
      return;
    }
    next(err);
  }
});

// Matches HomographyController.HasLocalHomography.
homographyRouter.get("/has-local/:deviceId", requireAuth, async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId?.trim()) {
      res.status(400).send("deviceId is required.");
      return;
    }

    const result = await homographyService.hasLocalHomography(deviceId);
    res.status(200).json({ HasLocalHomography: result });
  } catch (err) {
    next(err);
  }
});

// Matches HomographyController.GetSnapshotUrl. A device with no stored snapshot is a 200
// with SnapshotUrl: null in the old controller, not a 404 - preserved here.
homographyRouter.get("/snapshot-url/:deviceId/:cameraMac", requireAuth, async (req, res, next) => {
  try {
    const { deviceId, cameraMac } = req.params;
    if (!deviceId?.trim() || !cameraMac?.trim()) {
      res.status(400).send("deviceId and cameraMac are required.");
      return;
    }

    const url = await homographyService.getSnapshotUrl(deviceId, cameraMac);
    res.status(200).json({ SnapshotUrl: url });
  } catch (err) {
    next(err);
  }
});

// Matches HomographyController.GetPuzzleWorkspace.
homographyRouter.get(
  "/workspace/:projectId",
  requireAuth,
  requirePermission(Permissions.Project.Read),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      if (!projectId?.trim()) {
        res.status(400).send("projectId is required.");
        return;
      }

      const response = await homographyService.getPuzzleWorkspace(projectId);
      res.status(200).json(response);
    } catch (err) {
      if (err instanceof HomographyValidationError) {
        res.status(400).send(err.message);
        return;
      }
      next(err);
    }
  },
);

// Matches HomographyController.RefreshPuzzlePieces.
homographyRouter.post(
  "/workspace/:projectId/puzzle-pieces/refresh",
  requireAuth,
  requirePermission(Permissions.Project.Update),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      if (!projectId?.trim()) {
        res.status(400).send("projectId is required.");
        return;
      }

      const response = await homographyService.refreshPuzzlePieces(projectId);
      res.status(200).json(response);
    } catch (err) {
      if (err instanceof HomographyValidationError) {
        res.status(400).send(err.message);
        return;
      }
      next(err);
    }
  },
);

// Matches HomographyController.GetPuzzlePiece. `force` is `[FromQuery] bool` in ASP.NET,
// whose bool binder accepts only "true"/"false" (case-insensitive) - anything else, including
// "1", leaves it at the default false.
homographyRouter.get(
  "/workspace/:projectId/puzzle-pieces/:deviceId/:cameraMac",
  requireAuth,
  requirePermission(Permissions.Project.Read),
  async (req, res, next) => {
    try {
      const { projectId, deviceId, cameraMac } = req.params;
      if (!projectId?.trim()) {
        res.status(400).send("projectId is required.");
        return;
      }
      if (!deviceId?.trim() || !cameraMac?.trim()) {
        res.status(400).send("deviceId and cameraMac are required.");
        return;
      }

      const force = typeof req.query.force === "string" && req.query.force.toLowerCase() === "true";
      const response = await homographyService.getPuzzlePiece(projectId, deviceId, cameraMac, force);
      res.status(200).json(response);
    } catch (err) {
      if (err instanceof HomographyValidationError) {
        res.status(400).send(err.message);
        return;
      }
      if (err instanceof HomographyNotFoundError) {
        res.status(404).send(err.message);
        return;
      }
      next(err);
    }
  },
);

// Matches HomographyController.SaveGlobalHomographies.
homographyRouter.post(
  "/workspace/:projectId/global-homographies",
  requireAuth,
  requirePermission(Permissions.Project.Update),
  async (req, res, next) => {
    try {
      const { projectId } = req.params;
      if (!projectId?.trim()) {
        res.status(400).send("projectId is required.");
        return;
      }

      const dto = req.body as SaveGlobalHomographiesDto | undefined;
      if (!dto || typeof dto !== "object") {
        res.status(400).send("Invalid payload.");
        return;
      }

      // Mirrors HomographyController.ResolveCurrentUserId's claim fallback chain, collapsed
      // to this server's single JWT claims shape (tokenService.ts always issues `sub`).
      const userId = req.user?.sub;
      if (!userId?.trim()) {
        res.status(401).send("Missing user id claim.");
        return;
      }

      const response = await homographyService.saveGlobalHomographies(projectId, userId, dto);
      res.status(200).json(response);
    } catch (err) {
      if (err instanceof HomographyValidationError) {
        res.status(400).send(err.message);
        return;
      }
      next(err);
    }
  },
);
