import { Router } from "express";
import * as adminService from "../services/adminService.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("Admin"));

adminRouter.put("/update-role", async (req, res, next) => {
  try {
    const { TargetEmail, NewRole } = req.body ?? {};
    if (!TargetEmail || !NewRole) {
      res.status(400).send("Failed to update user role");
      return;
    }

    const success = await adminService.updateRole(TargetEmail, NewRole);
    if (!success) {
      res.status(400).send("Failed to update user role");
      return;
    }

    res.status(200).send("User role updated successfully");
  } catch (err) {
    next(err);
  }
});
