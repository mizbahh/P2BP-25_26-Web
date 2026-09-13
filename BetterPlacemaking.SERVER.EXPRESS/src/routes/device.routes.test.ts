import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { FakeFirestore } from "../test/fakeFirestore.js";

const fake = new FakeFirestore();
vi.mock("../config/firebase.js", () => ({ getDb: () => fake }));
vi.mock("../authorization/authorizationService.js", () => ({
  hasGlobalPermission: async () => true,
  hasProjectPermission: async () => true,
  getEffectiveGlobalPermissions: async () => [],
  getEffectiveProjectPermissions: async () => [],
  getProjectRoleOptions: async () => [],
}));

const { createApp } = await import("../app.js");
const { createUserToken } = await import("../services/tokenService.js");

function authHeader(): string {
  const { token } = createUserToken({ Id: "user-1", Email: "a@b.com", Role: "User" } as never);
  return `Bearer ${token}`;
}

describe("POST /api/device/project/:projectId (clobber fix)", () => {
  it("ignores a client-supplied Id and creates a new document instead of overwriting an existing one", async () => {
    await fake.collection("devices").doc("existing-device").set({
      ProjectId: "proj-1",
      Name: "Original Device",
      ApiKeyHash: "untouchable-secret-hash",
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/device/project/proj-1")
      .set("Authorization", authHeader())
      .send({ Id: "existing-device", Name: "Attempted overwrite" });

    expect(res.status).toBe(201);
    expect(res.body.Id).not.toBe("existing-device");
    expect(res.body.Name).toBe("Attempted overwrite");

    const original = fake.peek("devices/existing-device");
    expect(original?.Name).toBe("Original Device");
    expect(original?.ApiKeyHash).toBe("untouchable-secret-hash");
  });
});

describe("PUT /api/device/project/:projectId/:id", () => {
  it("preserves ApiKeyHash and HealthReport regardless of the request body", async () => {
    await fake.collection("devices").doc("dev-1").set({
      ProjectId: "proj-1",
      Name: "Old Name",
      ApiKeyHash: "keep-me",
      HealthReport: { Timestamp: 123 },
    });

    const app = createApp();
    const res = await request(app)
      .put("/api/device/project/proj-1/dev-1")
      .set("Authorization", authHeader())
      .send({ Id: "dev-1", Name: "New Name", ApiKeyHash: "attacker-supplied", HealthReport: null });

    expect(res.status).toBe(200);
    expect(res.body.Name).toBe("New Name");

    const stored = fake.peek("devices/dev-1");
    expect(stored?.ApiKeyHash).toBe("keep-me");
    expect(stored?.HealthReport).toEqual({ Timestamp: 123 });
  });
});
