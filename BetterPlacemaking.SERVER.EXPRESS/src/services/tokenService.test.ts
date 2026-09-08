import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { createUserToken, verifyUserToken } from "./tokenService.js";
import type { User } from "../models/types.js";

const user: User = {
  Id: "user-1",
  Email: "alice@example.com",
  FirstName: "Alice",
  LastName: "Anderson",
  Role: "User",
};

describe("tokenService", () => {
  it("mints a token that verifies back to the same claims", () => {
    const { token } = createUserToken(user);
    const claims = verifyUserToken(token);

    expect(claims.sub).toBe("user-1");
    expect(claims.email).toBe("alice@example.com");
    expect(claims.role).toBe("User");
    expect(claims.name).toBe("Alice Anderson");
  });

  it("omits the name claim when both names are blank", () => {
    const { token } = createUserToken({ ...user, FirstName: null, LastName: null });
    const claims = verifyUserToken(token);
    expect(claims.name).toBeUndefined();
  });

  it("rejects a token signed with the wrong key", () => {
    const forged = jwt.sign({ sub: "user-1" }, "wrong-key", {
      issuer: "BetterPlacemaking",
      audience: "BetterPlacemaking.Client",
    });
    expect(() => verifyUserToken(forged)).toThrow();
  });

  it("rejects an expired token", () => {
    const expired = jwt.sign({ sub: "user-1" }, process.env.JWT_KEY!, {
      issuer: "BetterPlacemaking",
      audience: "BetterPlacemaking.Client",
      expiresIn: "-1h",
    });
    expect(() => verifyUserToken(expired)).toThrow(/expired/i);
  });

  it("rejects a token with the wrong audience", () => {
    const wrongAudience = jwt.sign({ sub: "user-1" }, process.env.JWT_KEY!, {
      issuer: "BetterPlacemaking",
      audience: "SomeoneElse",
    });
    expect(() => verifyUserToken(wrongAudience)).toThrow();
  });
});
