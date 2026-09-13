import { Router } from "express";
import * as scanScheduleService from "../services/scanScheduleService.js";
import { Permissions } from "../authorization/permissions.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { toScanScheduleDto } from "../models/scanSchedule.js";

export const scanScheduleRouter = Router();

scanScheduleRouter.use(requireAuth);

// CRUD/config only - matches ScanScheduleController. The actual scan-triggering logic
// (ScanScheduleExecutorService) is a background job runner with no HTTP surface of its
// own and is being ported separately; nothing here wires into it.
scanScheduleRouter.post(
  "/:projectId",
  requirePermission(Permissions.Project.ScanSchedulesManage),
  async (req, res, next) => {
    try {
      const { StartDate, StartTime, Frequency, EndDate, EndTime, LastRunAt } = req.body ?? {};
      const schedule = await scanScheduleService.createSchedule(
        req.params.projectId,
        { StartDate, StartTime, Frequency, EndDate, EndTime, LastRunAt },
        req.user!.sub,
      );
      res.status(200).json({ Id: schedule.Id });
    } catch (err) {
      next(err);
    }
  },
);

scanScheduleRouter.get(
  "/:projectId",
  requirePermission(Permissions.Project.ScanSchedulesRead),
  async (req, res, next) => {
    try {
      const schedules = await scanScheduleService.getSchedules(req.params.projectId);
      res.status(200).json(schedules.map(toScanScheduleDto));
    } catch (err) {
      next(err);
    }
  },
);

scanScheduleRouter.delete(
  "/:projectId/:scheduleId",
  requirePermission(Permissions.Project.ScanSchedulesManage),
  async (req, res, next) => {
    try {
      const deleted = await scanScheduleService.deleteSchedule(req.params.projectId, req.params.scheduleId);
      res.status(deleted ? 204 : 404).send();
    } catch (err) {
      next(err);
    }
  },
);

scanScheduleRouter.put(
  "/:projectId/:scheduleId",
  requirePermission(Permissions.Project.ScanSchedulesManage),
  async (req, res, next) => {
    try {
      const { StartDate, StartTime, Frequency, EndDate, EndTime } = req.body ?? {};
      const updated = await scanScheduleService.updateSchedule(req.params.projectId, req.params.scheduleId, {
        StartDate,
        StartTime,
        Frequency,
        EndDate,
        EndTime,
      });
      res.status(updated ? 204 : 404).send();
    } catch (err) {
      next(err);
    }
  },
);
