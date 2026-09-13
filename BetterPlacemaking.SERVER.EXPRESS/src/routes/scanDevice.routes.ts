import { Router } from "express";
import * as scanDeviceService from "../services/scanDeviceService.js";
import { requireDeviceApiKey } from "../middleware/requireDeviceApiKey.js";

/**
 * Ported from BetterPlacemaking.SERVER/Controllers/ScanDeviceController.cs - the
 * device-authenticated scan queue the Jetson orchestrator polls/updates (API key in
 * the Authorization header, via requireDeviceApiKey - the "DeviceApiKey" auth policy
 * on the old server, not the "UserJwt" default policy requireAuth enforces elsewhere
 * in this app). The old route was `api/scan/device`; mounted here at
 * `/api/scan-device` to match this server's flat, hyphenated single-segment resource
 * convention (/api/device, /api/project, /api/scan-schedule, ...).
 *
 * Not ported (see scanDeviceService.ts for detail): visualizer ingest
 * (ScanCompleteVisualizerIngestService), scan-completion email notifications
 * (NotificationService), and the lidar one-shot flag clear
 * (DeviceService.ClearLidarScanOneShotIfSet) - all three are separate, not-yet-migrated
 * dependencies with no Express equivalent yet, and the status-update endpoint still
 * transitions the scan's Status correctly without them.
 */
export const scanDeviceRouter = Router();

scanDeviceRouter.use(requireDeviceApiKey);

scanDeviceRouter.get("/next-pending", async (req, res, next) => {
  try {
    const device = req.device;
    if (!device?.Id) {
      res.status(401).send();
      return;
    }

    if (!device.ProjectId?.trim()) {
      res.status(404).json({ Message: "Device has no ProjectId; assign the device to a project in admin." });
      return;
    }

    const scanId = await scanDeviceService.getNextPendingScanId(device.ProjectId, device.Id);
    if (!scanId) {
      res.status(404).send();
      return;
    }

    res.status(200).json({
      ProjectId: device.ProjectId,
      DeviceId: device.Id,
      ScanId: scanId,
    });
  } catch (err) {
    next(err);
  }
});

scanDeviceRouter.patch("/:scanId/status", async (req, res, next) => {
  try {
    const device = req.device;
    if (!device?.Id) {
      res.status(401).send();
      return;
    }

    if (!device.ProjectId?.trim()) {
      res.status(400).json({ Message: "Device has no ProjectId." });
      return;
    }

    const body = req.body;
    if (!body || !req.params.scanId?.trim()) {
      res.status(400).send();
      return;
    }

    const existing = await scanDeviceService.getScan(device.ProjectId, device.Id, req.params.scanId);
    if (!existing) {
      res.status(404).send();
      return;
    }

    const { Status, ObjUrl, Error: ScanError } = body;
    const updated = await scanDeviceService.updateScanStatus(device.ProjectId, device.Id, req.params.scanId, {
      Status,
      ObjUrl,
      Error: ScanError,
    });
    if (!updated) {
      res.status(404).send();
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
