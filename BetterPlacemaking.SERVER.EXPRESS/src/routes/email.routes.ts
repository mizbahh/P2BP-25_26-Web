import { Router } from "express";
import * as userService from "../services/userService.js";

export const emailRouter = Router();

emailRouter.get("/verify-email", async (req, res, next) => {
  try {
    const token = req.query.token as string | undefined;
    if (!token) {
      res.status(400).send("Invalid or expired token");
      return;
    }

    const user = await userService.getUserByVerificationToken(token);
    if (!user) {
      res.status(400).send("Invalid or expired token");
      return;
    }

    await userService.markEmailVerified(user.Id);
    res.status(200).send("Email verified successfully");
  } catch (err) {
    next(err);
  }
});
