import type { NextFunction, Request, Response } from "express";
import { ValidationError as PasswordValidationError } from "../services/passwordService.js";
import { SettingsValidationError } from "../services/userService.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof PasswordValidationError || err instanceof SettingsValidationError) {
    res.status(400).json({ Message: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ Message: "An unexpected error occurred." });
}
