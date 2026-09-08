import { describe, expect, it } from "vitest";
import { parsePermission } from "./policy.js";

describe("parsePermission", () => {
  it("infers Global scope from the prefix", () => {
    expect(parsePermission("Global.Users.Read")).toEqual({ scope: "Global", permission: "Global.Users.Read" });
  });

  it("infers Project scope from the prefix", () => {
    expect(parsePermission("Project.Read")).toEqual({ scope: "Project", permission: "Project.Read" });
  });

  it("is case-insensitive when detecting the prefix", () => {
    expect(parsePermission("global.users.read")?.scope).toBe("Global");
    expect(parsePermission("PROJECT.read")?.scope).toBe("Project");
  });

  it("returns null for an unrecognized prefix", () => {
    expect(parsePermission("Device.Read")).toBeNull();
    expect(parsePermission("")).toBeNull();
  });
});
