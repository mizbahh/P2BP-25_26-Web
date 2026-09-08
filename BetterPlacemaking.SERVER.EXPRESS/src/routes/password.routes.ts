import { Router } from "express";
import * as passwordService from "../services/passwordService.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const passwordRouter = Router();

passwordRouter.post("/request-reset", async (req, res, next) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      res.status(400).send("Email is required");
      return;
    }

    const sent = await passwordService.requestPasswordReset(email);
    if (!sent) {
      res.status(400).send("User not found");
      return;
    }

    res.status(200).send("Password reset email sent");
  } catch (err) {
    next(err);
  }
});

passwordRouter.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword) {
      res.status(400).send("Invalid or expired token");
      return;
    }

    const success = await passwordService.resetPassword(token, newPassword);
    if (!success) {
      res.status(400).send("Invalid or expired token");
      return;
    }

    res.status(200).send("Password updated");
  } catch (err) {
    next(err);
  }
});

passwordRouter.post("/me/change", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }

    const { currentPassword, newPassword } = req.body ?? {};
    const success = await passwordService.changePassword(userId, currentPassword ?? "", newPassword ?? "");
    if (!success) {
      res.status(400).json({ Message: "Current password is incorrect." });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
