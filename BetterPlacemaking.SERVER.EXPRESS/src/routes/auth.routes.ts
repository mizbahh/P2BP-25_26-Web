import { Router } from "express";
import * as authSessionService from "../services/authSessionService.js";
import { REFRESH_COOKIE_NAME, clearRefreshCookie, setRefreshCookie } from "./cookies.js";

export const authRouter = Router();

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      res.status(401).json({ Success: false, Message: "Missing refresh token" });
      return;
    }

    const result = await authSessionService.refresh(refreshToken, req.headers["user-agent"]);

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

authRouter.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (refreshToken) {
      await authSessionService.logout(refreshToken);
    }
    clearRefreshCookie(res);
    res.status(200).json({ Success: true });
  } catch (err) {
    next(err);
  }
});
