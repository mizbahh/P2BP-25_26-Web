import { Router } from "express";
import * as authSessionService from "../services/authSessionService.js";
import { setRefreshCookie } from "./cookies.js";

export const loginRouter = Router();

loginRouter.post("/authenticate", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ Success: false, Message: "Email and password are required." });
      return;
    }

    const result = await authSessionService.authenticate(email, password, req.headers["user-agent"]);

    if (!result.response.Success) {
      res.status(401).json(result.response);
      return;
    }

    if (result.refreshToken && result.refreshExpiresAtUtc) {
      setRefreshCookie(res, result.refreshToken, result.refreshExpiresAtUtc);
    }

    res.status(200).json(result.response);
  } catch (err) {
    next(err);
  }
});
