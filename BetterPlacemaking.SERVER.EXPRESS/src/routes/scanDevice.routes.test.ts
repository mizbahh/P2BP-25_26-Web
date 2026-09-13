import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { Timestamp } from "firebase-admin/firestore";
import { FakeFirestore } from "../test/fakeFirestore.js";

const fake = new FakeFirestore();
vi.mock("../config/firebase.js", () => ({ getDb: () => fake }));

// Not wired into app.ts yet (another migration step mounts it), so the test builds a
// minimal app around the router directly - same middleware stack app.ts uses.
const { scanDeviceRouter } = await import("./scanDevice.routes.js");
const { computeApiKeyHash } = await import("../middleware/requireDeviceApiKey.js");
const { errorHandler } = await import("../middleware/errorHandler.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/scan-device", scanDeviceRouter);
  app.use(errorHandler);
  return app;
}

// Each device gets its own API key (derived from its id) - ApiKeyHash lookups query
// across the whole shared `devices` collection, so reusing one key for every seeded
// device would make the lookup ambiguous across tests in this file.
function apiKeyFor(id: string): string {
  return `test-api-key-${id}`;
}

async function seedDevice(id: string, projectId: string | null) {
  await fake.collection("devices").doc(id).set({
    ProjectId: projectId,
    Name: "Jetson Unit",
    ApiKeyHash: computeApiKeyHash(apiKeyFor(id)),
  });
}

function deviceAuthHeader(id: string): string {
  return `Bearer ${apiKeyFor(id)}`;
}

describe("device API key auth (requireDeviceApiKey)", () => {
  it("rejects requests with no Authorization header", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/scan-device/next-pending");
    expect(res.status).toBe(401);
  });

  it("rejects requests with an unknown device API key", async () => {
    await seedDevice("dev-1", "proj-1");
    const app = buildApp();
    const res = await request(app)
      .get("/api/scan-device/next-pending")
      .set("Authorization", "Bearer not-a-real-key");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/scan-device/next-pending", () => {
  it("returns the oldest pending scan for the device's project", async () => {
    await seedDevice("dev-2", "proj-1");
    await fake
      .collection("projects/proj-1/devices/dev-2/scans")
      .doc("scan-newer")
      .set({ Status: "pending", CreatedAt: Timestamp.fromDate(new Date("2026-01-02T00:00:00Z")) });
    await fake
      .collection("projects/proj-1/devices/dev-2/scans")
      .doc("scan-older")
      .set({ Status: "pending", CreatedAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")) });
    await fake
      .collection("projects/proj-1/devices/dev-2/scans")
      .doc("scan-running")
      .set({ Status: "running", CreatedAt: Timestamp.fromDate(new Date("2025-12-31T00:00:00Z")) });

    const app = buildApp();
    const res = await request(app)
      .get("/api/scan-device/next-pending")
      .set("Authorization", deviceAuthHeader("dev-2"));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ProjectId: "proj-1", DeviceId: "dev-2", ScanId: "scan-older" });
  });

  it("returns 404 when the device has no pending scans", async () => {
    await seedDevice("dev-3", "proj-1");

    const app = buildApp();
    const res = await request(app)
      .get("/api/scan-device/next-pending")
      .set("Authorization", deviceAuthHeader("dev-3"));

    expect(res.status).toBe(404);
  });

  it("returns 404 when the device has no ProjectId assigned", async () => {
    await seedDevice("dev-4", null);

    const app = buildApp();
    const res = await request(app)
      .get("/api/scan-device/next-pending")
      .set("Authorization", deviceAuthHeader("dev-4"));

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/scan-device/:scanId/status", () => {
  it("updates the scan's Status and stamps StartedAt when transitioning to running", async () => {
    await seedDevice("dev-5", "proj-1");
    await fake
      .collection("projects/proj-1/devices/dev-5/scans")
      .doc("scan-1")
      .set({ Status: "pending" });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/scan-device/scan-1/status")
      .set("Authorization", deviceAuthHeader("dev-5"))
      .send({ Status: "running" });

    expect(res.status).toBe(204);

    const stored = fake.peek("projects/proj-1/devices/dev-5/scans/scan-1");
    expect(stored?.Status).toBe("running");
    expect(stored?.StartedAt).toBeTruthy();
  });

  it("stamps FinishedAt and stores ObjUrl when transitioning to complete", async () => {
    await seedDevice("dev-6", "proj-1");
    await fake
      .collection("projects/proj-1/devices/dev-6/scans")
      .doc("scan-2")
      .set({ Status: "running" });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/scan-device/scan-2/status")
      .set("Authorization", deviceAuthHeader("dev-6"))
      .send({ Status: "complete", ObjUrl: "gs://bucket/scan-2.obj" });

    expect(res.status).toBe(204);

    const stored = fake.peek("projects/proj-1/devices/dev-6/scans/scan-2");
    expect(stored?.Status).toBe("complete");
    expect(stored?.ObjUrl).toBe("gs://bucket/scan-2.obj");
    expect(stored?.FinishedAt).toBeTruthy();
  });

  it("returns 404 for a scan that does not exist", async () => {
    await seedDevice("dev-7", "proj-1");

    const app = buildApp();
    const res = await request(app)
      .patch("/api/scan-device/does-not-exist/status")
      .set("Authorization", deviceAuthHeader("dev-7"))
      .send({ Status: "running" });

    expect(res.status).toBe(404);
  });

  it("rejects requests without a valid device API key", async () => {
    await seedDevice("dev-8", "proj-1");
    await fake
      .collection("projects/proj-1/devices/dev-8/scans")
      .doc("scan-3")
      .set({ Status: "pending" });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/scan-device/scan-3/status")
      .set("Authorization", "Bearer wrong-key")
      .send({ Status: "running" });

    expect(res.status).toBe(401);
  });
});
