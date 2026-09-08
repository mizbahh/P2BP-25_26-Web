import bcrypt from "bcryptjs";
import * as userService from "./userService.js";
import * as refreshTokenService from "./refreshTokenService.js";
import { createUserToken } from "./tokenService.js";
import { toPublicUser, type LoginResponse } from "../models/types.js";

export interface AuthResult {
  response: LoginResponse;
  refreshToken?: string;
  refreshExpiresAtUtc?: Date;
}

export async function authenticate(email: string, password: string, userAgent: string | undefined): Promise<AuthResult> {
  const user = await userService.getUserByEmail(email);
  if (!user) {
    return { response: { Success: false, Message: "User does not exist" } };
  }

  const passwordMatches = user.Password ? await bcrypt.compare(password, user.Password) : false;
  if (!passwordMatches) {
    return { response: { Success: false, Message: "Wrong password" } };
  }

  if (!user.EmailVerified) {
    return { response: { Success: false, Message: "Email not verified. Please check your email." } };
  }

  const { token, expiresAtUtc } = createUserToken(user);
  const refresh = await refreshTokenService.issue(user.Id, userAgent);

  return {
    response: {
      Success: true,
      Message: "Login successful",
      User: toPublicUser(user),
      Token: token,
      ExpiresAtUtc: expiresAtUtc.toISOString(),
    },
    refreshToken: refresh.token,
    refreshExpiresAtUtc: refresh.expiresAtUtc,
  };
}

export async function refresh(refreshToken: string, userAgent: string | undefined): Promise<AuthResult> {
  const record = await refreshTokenService.findActive(refreshToken);
  if (!record || !record.UserId) {
    return { response: { Success: false, Message: "Invalid refresh token" } };
  }

  const user = await userService.getUserById(record.UserId);
  if (!user) {
    return { response: { Success: false, Message: "User not found" } };
  }

  const rotated = await refreshTokenService.rotate(record, userAgent);
  const { token, expiresAtUtc } = createUserToken(user);

  return {
    response: {
      Success: true,
      Message: "Login successful",
      User: toPublicUser(user),
      Token: token,
      ExpiresAtUtc: expiresAtUtc.toISOString(),
    },
    refreshToken: rotated.token,
    refreshExpiresAtUtc: rotated.expiresAtUtc,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  const record = await refreshTokenService.findActive(refreshToken);
  if (!record) return;
  await refreshTokenService.revoke(record.Id);
}
