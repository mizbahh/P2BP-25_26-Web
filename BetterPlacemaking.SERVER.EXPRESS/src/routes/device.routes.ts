import { Router } from "express";
import * as deviceService from "../services/deviceService.js";
import { Permissions } from "../authorization/permissions.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { toDeviceDto } from "../models/device.js";

export const deviceRouter = Router();

deviceRouter.use(requireAuth);

// Matches DeviceController.GetDevices: authenticated-only, no permission check,
// unscoped - a known gap in the ASP.NET server, ported faithfully (not one of
// the two bugs the migration plan called out for fixing).
deviceRouter.get("/", async (_req, res, next) => {
  try {
    const devices = await deviceService.getDevices();
    res.status(200).json(devices.map(toDeviceDto));
  } catch (err) {
    next(err);
  }
});

deviceRouter.get(
  "/project/:projectId",
  requirePermission(Permissions.Project.DevicesRead),
  async (req, res, next) => {
    try {
      if (!req.params.projectId?.trim()) {
        res.status(400).send();
        return;
      }
      const devices = await deviceService.getDevicesByProjectId(req.params.projectId);
      res.status(200).json(devices.map(toDeviceDto));
    } catch (err) {
      next(err);
    }
  },
);

deviceRouter.get(
  "/project/:projectId/:id",
  requirePermission(Permissions.Project.DevicesRead),
  async (req, res, next) => {
    try {
      const device = await deviceService.getDevice(req.params.id);
      if (!device || device.ProjectId?.toLowerCase() !== req.params.projectId.toLowerCase()) {
        res.status(404).send();
        return;
      }
      res.status(200).json(toDeviceDto(device));
    } catch (err) {
      next(err);
    }
  },
);

deviceRouter.post(
  "/project/:projectId",
  requirePermission(Permissions.Project.DevicesManage),
  async (req, res, next) => {
    try {
      if (!req.params.projectId?.trim()) {
        res.status(400).send();
        return;
      }
      const { Name, Config } = req.body ?? {};
      const device = await deviceService.addDevice({ ProjectId: req.params.projectId, Name, Config });
      res.status(201).location(`/api/device/project/${req.params.projectId}/${device.Id}`).json(toDeviceDto(device));
    } catch (err) {
      next(err);
    }
  },
);

deviceRouter.put(
  "/project/:projectId/:id",
  requirePermission(Permissions.Project.DevicesManage),
  async (req, res, next) => {
    try {
      if (req.body?.Id && req.body.Id !== req.params.id) {
        res.status(400).send();
        return;
      }
      const existing = await deviceService.getDevice(req.params.id);
      if (!existing || existing.ProjectId?.toLowerCase() !== req.params.projectId.toLowerCase()) {
        res.status(404).send();
        return;
      }

      const { Name, Config } = req.body ?? {};
      const updated = await deviceService.updateDevice(req.params.id, {
        ProjectId: req.params.projectId,
        Name,
        Config,
      });
      if (!updated) {
        res.status(404).send();
        return;
      }
      res.status(200).json(toDeviceDto(updated));
    } catch (err) {
      next(err);
    }
  },
);

deviceRouter.delete(
  "/project/:projectId/:id",
  requirePermission(Permissions.Project.DevicesManage),
  async (req, res, next) => {
    try {
      const existing = await deviceService.getDevice(req.params.id);
      if (!existing || existing.ProjectId?.toLowerCase() !== req.params.projectId.toLowerCase()) {
        res.status(404).send();
        return;
      }
      await deviceService.deleteDevice(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

deviceRouter.post(
  "/project/:projectId/:id/apikey",
  requirePermission(Permissions.Project.DevicesManage),
  async (req, res, next) => {
    try {
      const existing = await deviceService.getDevice(req.params.id);
      if (!existing || existing.ProjectId?.toLowerCase() !== req.params.projectId.toLowerCase()) {
        res.status(404).send();
        return;
      }
      const apiKey = await deviceService.generateAndUpdateApiKey(req.params.id);
      if (!apiKey) {
        res.status(404).send();
        return;
      }
      res.status(200).json({ ApiKey: apiKey });
    } catch (err) {
      next(err);
    }
  },
);
