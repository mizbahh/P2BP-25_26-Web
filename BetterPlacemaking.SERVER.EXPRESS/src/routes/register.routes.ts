import { Router } from "express";
import * as userService from "../services/userService.js";
import * as emailService from "../services/emailService.js";
import { toPublicUser } from "../models/types.js";

export const registerRouter = Router();

registerRouter.post("/", async (req, res, next) => {
  try {
    const { FirstName, LastName, Email, Password } = req.body ?? {};
    if (!Email || !Password) {
      res.status(400).json({ Success: false, Message: "Email and password are required." });
      return;
    }

    const user = await userService.addUser({ FirstName, LastName, Email, Password });
    if (!user) {
      res.status(400).json({ Success: false, Message: "Email already exists" });
      return;
    }

    if (user.Email && user.EmailVerificationToken) {
      await emailService.sendVerificationEmail(user.Email, user.EmailVerificationToken);
    }

    // Deviation from the ASP.NET server: this includes the new user's Id (see plan).
    res.status(200).json({ Success: true, Message: "Registration successful", User: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});
