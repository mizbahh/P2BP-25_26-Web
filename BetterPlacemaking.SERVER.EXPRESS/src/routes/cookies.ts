import type { Response } from "express";

export const REFRESH_COOKIE_NAME = "bp_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";

export function setRefreshCookie(res: Response, token: string, expiresAtUtc: Date): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: REFRESH_COOKIE_PATH,
    expires: expiresAtUtc,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: REFRESH_COOKIE_PATH,
  });
}
