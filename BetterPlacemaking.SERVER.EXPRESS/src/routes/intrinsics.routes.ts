import { Router } from "express";
import * as intrinsicsService from "../services/intrinsicsService.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireDeviceApiKey } from "../middleware/requireDeviceApiKey.js";
import type { SubmitIntrinsicsResultDto, SubmitIntrinsicsSightingsDto } from "../models/intrinsics.js";

export const intrinsicsRouter = Router();

// Unlike the other ported resources, IntrinsicsController mixes two auth
// policies per-action (DeviceApiKey for the two submit endpoints devices call
// themselves, UserJwt for the two read endpoints the client app calls), so
// auth is applied per-route below instead of once via `router.use(...)`.

// Matches IntrinsicsController.SubmitSightings.
intrinsicsRouter.post("/submit-sightings", requireDeviceApiKey, async (req, res, next) => {
  try {
    const dto = req.body as SubmitIntrinsicsSightingsDto | undefined;
    if (!dto || typeof dto !== "object" || !Array.isArray(dto.Sightings)) {
      res.status(400).send("Invalid payload.");
      return;
    }

    const deviceId = req.device?.Id;
    if (!deviceId) {
      res.status(401).send("Invalid API key.");
      return;
    }

    const response = await intrinsicsService.submitSightings(deviceId, dto);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Matches IntrinsicsController.SubmitResult.
intrinsicsRouter.post("/submit-result", requireDeviceApiKey, async (req, res, next) => {
  try {
    const dto = req.body as SubmitIntrinsicsResultDto | undefined;
    if (!dto || typeof dto !== "object") {
      res.status(400).send("Invalid payload.");
      return;
    }

    const deviceId = req.device?.Id;
    if (!deviceId) {
      res.status(401).send("Invalid API key.");
      return;
    }

    const response = await intrinsicsService.storeResult(deviceId, dto);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Matches IntrinsicsController.GetModelIntrinsics. Registered before the
// "/:deviceId/:mac" route below so the literal "model" segment isn't captured
// as a deviceId (ASP.NET attribute routing prefers literal segments regardless
// of declaration order; Express does not, so order matters here).
intrinsicsRouter.get("/model/:modelId", requireAuth, async (req, res, next) => {
  try {
    if (!req.params.modelId?.trim()) {
      res.status(400).send("modelId is required.");
      return;
    }

    const response = await intrinsicsService.getModelIntrinsics(req.params.modelId);
    if (!response) {
      res.status(404).send("No intrinsics found for the given model.");
      return;
    }
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

// Matches IntrinsicsController.GetIntrinsics.
intrinsicsRouter.get("/:deviceId/:mac", requireAuth, async (req, res, next) => {
  try {
    const { deviceId, mac } = req.params;
    if (!deviceId?.trim() || !mac?.trim()) {
      res.status(400).send("deviceId and mac are required.");
      return;
    }

    const modelId = typeof req.query.modelId === "string" ? req.query.modelId : undefined;
    const response = await intrinsicsService.getIntrinsics(deviceId, mac, modelId);
    if (!response) {
      res.status(404).send("No intrinsics found for the given device and camera.");
      return;
    }
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});
