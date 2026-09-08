import jwt from "jsonwebtoken";
import { accessTokenMinutes, env } from "../config/env.js";
import type { JwtClaims, User } from "../models/types.js";

export interface CreatedToken {
  token: string;
  expiresAtUtc: Date;
}

export function createUserToken(user: User): CreatedToken {
  const expiresAtUtc = new Date(Date.now() + accessTokenMinutes() * 60_000);

  const claims: JwtClaims = {
    sub: user.Id,
    email: user.Email ?? undefined,
    role: user.Role ?? undefined,
  };
  const name = `${user.FirstName ?? ""} ${user.LastName ?? ""}`.trim();
  if (name) claims.name = name;

  const token = jwt.sign(claims, env.jwtKey, {
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
    expiresIn: `${accessTokenMinutes()}m`,
  });

  return { token, expiresAtUtc };
}

export function verifyUserToken(token: string): JwtClaims {
  // clockTolerance is in seconds; matches the ASP.NET server's 2-minute ClockSkew.
  return jwt.verify(token, env.jwtKey, {
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
    clockTolerance: 120,
  }) as JwtClaims;
}
