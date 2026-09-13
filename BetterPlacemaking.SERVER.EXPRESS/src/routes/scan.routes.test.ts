import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { Timestamp } from "firebase-admin/firestore";
import { FakeFirestore } from "../test/fakeFirestore.js";

const fake = new FakeFirestore();
const hasGlobalPermission = vi.fn(async () => false);
const hasProjectPermission = vi.fn(
  async (_userId: string, _role: string | undefined, projectId: string) => projectId === "proj-1",
);

vi.mock("../config/firebase.js", () => ({ getDb: () => fake }));
vi.mock("../authorization/authorizationService.js", () => ({
  hasGlobalPermission: (...args: unknown[]) => hasGlobalPermission(...(args as [string, string | undefined, string])),
  hasProjectPermission: (...args: unknown[]) =>
    hasProjectPermission(...(args as [string, string | undefined, string, string])),
  getEffectiveGlobalPermissions: async () => [],
  getEffectiveProjectPermissions: async () => [],
  getProjectRoleOptions: async () => [],
}));

// Not wired into app.ts yet (another migration step mounts it), so the test builds a minimal
// app around the router directly - same middleware stack app.ts uses (see scanSchedule.routes.test.ts).
const { scanRouter } = await import("./scan.routes.js");
const { errorHandler } = await import("../middleware/errorHandler.js");
const { createUserToken } = await import("../services/tokenService.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/scan", scanRouter);
  app.use(errorHandler);
  return app;
}

function authHeader(userId = "user-1"): string {
  const { token } = createUserToken({ Id: userId, Email: "a@b.com", Role: "User" } as never);
  return `Bearer ${token}`;
}

const validSettings = {
  scan_resolution: 16,
  protocol_mode: "express",
  orientation_mode: "table",
  output_mode: "raw_and_filtered",
  split_mode: "none",
  filter_enabled: true,
  capture_strategy: "fixed_time",
  min_revolutions_per_slice: 2,
  force_recalibration: false,
};

describe("POST /api/scan/:projectId/:deviceId (StartScan)", () => {
  it("creates a pending scan and stamps InitiatedByUserId", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scan/proj-1/dev-1")
      .set("Authorization", authHeader("user-1"))
      .send(validSettings);

    expect(res.status).toBe(200);
    expect(res.body.Status).toBe("pending");
    expect(res.body.Id).toBeTruthy();

    const stored = fake.peek(`projects/proj-1/devices/dev-1/scans/${res.body.Id}`);
    expect(stored?.Status).toBe("pending");
    expect(stored?.InitiatedByUserId).toBe("user-1");
    expect(stored?.scan_resolution).toBe(16);
    expect(stored?.CreatedAt).toBeTruthy();
  });

  it("rejects invalid scan settings with 400", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scan/proj-1/dev-1")
      .set("Authorization", authHeader())
      .send({ ...validSettings, scan_resolution: 999 });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("invalid_scan_settings");
  });

  it("returns 400 when scan settings are missing entirely", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/scan/proj-1/dev-1").set("Authorization", authHeader()).send();
    expect(res.status).toBe(400);
  });

  it("returns 409 scan_in_progress when a scan is already running", async () => {
    await fake
      .collection("projects/proj-1/devices/dev-2/scans")
      .doc("scan-running")
      .set({ Status: "running", CreatedAt: Timestamp.now() });

    const app = buildApp();
    const res = await request(app)
      .post("/api/scan/proj-1/dev-2")
      .set("Authorization", authHeader())
      .send(validSettings);

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ reason: "scan_in_progress", scanId: "scan-running", status: "running" });
  });

  it("returns the existing scan (200) instead of creating a new one when a scan is already pending", async () => {
    await fake
      .collection("projects/proj-1/devices/dev-3/scans")
      .doc("scan-pending")
      .set({ Status: "pending", CreatedAt: Timestamp.now() });

    const app = buildApp();
    const res = await request(app)
      .post("/api/scan/proj-1/dev-3")
      .set("Authorization", authHeader())
      .send(validSettings);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ Id: "scan-pending", Status: "pending" });

    const snapshot = await fake.collection("projects/proj-1/devices/dev-3/scans").get();
    expect(snapshot.docs.length).toBe(1);
  });

  it("denies starting a scan when the caller lacks Project.Scans.Start on the project", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/scan/proj-other/dev-1")
      .set("Authorization", authHeader())
      .send(validSettings);

    expect(res.status).toBe(403);
  });

  it("rejects requests with no Authorization header", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/scan/proj-1/dev-1").send(validSettings);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/scan/:projectId/:deviceId (GetScans)", () => {
  it("lists scans for the device with ISO timestamps", async () => {
    await fake
      .collection("projects/proj-1/devices/dev-4/scans")
      .doc("scan-a")
      .set({ Status: "complete", CreatedAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")) });

    const app = buildApp();
    const res = await request(app).get("/api/scan/proj-1/dev-4").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ Id: "scan-a", Status: "complete" });
    expect(res.body[0].CreatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("denies listing scans when the caller lacks Project.Scans.Read on the project", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/scan/proj-other/dev-4").set("Authorization", authHeader());
    expect(res.status).toBe(403);
  });
});

describe("GET /api/scan/:projectId/:deviceId/:scanId (GetScan)", () => {
  it("returns a single scan", async () => {
    await fake.collection("projects/proj-1/devices/dev-5/scans").doc("scan-5").set({ Status: "pending" });

    const app = buildApp();
    const res = await request(app).get("/api/scan/proj-1/dev-5/scan-5").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ Id: "scan-5", Status: "pending" });
  });

  it("returns 404 for a scan that does not exist", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/scan/proj-1/dev-5/does-not-exist").set("Authorization", authHeader());
    expect(res.status).toBe(404);
  });
});

describe("GET /api/scan/:projectId/:deviceId/:scanId/xyz (DownloadScanXyz)", () => {
  it("returns 404 for a scan that does not exist", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/scan/proj-1/dev-5/does-not-exist/xyz").set("Authorization", authHeader());
    expect(res.status).toBe(404);
  });

  it("returns 404 xyz_unavailable for an existing scan (visualizer ingest not yet ported)", async () => {
    await fake
      .collection("projects/proj-1/devices/dev-5/scans")
      .doc("scan-6")
      .set({ Status: "complete", ObjUrl: "https://example.com/scan-6.xyz" });

    const app = buildApp();
    const res = await request(app).get("/api/scan/proj-1/dev-5/scan-6/xyz").set("Authorization", authHeader());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ reason: "xyz_unavailable" });
  });

  it("is gated by Project.Export, not Project.Scans.Read", async () => {
    await fake.collection("projects/proj-1/devices/dev-5/scans").doc("scan-7").set({ Status: "complete" });
    hasProjectPermission.mockImplementationOnce(async () => false);

    const app = buildApp();
    const res = await request(app).get("/api/scan/proj-1/dev-5/scan-7/xyz").set("Authorization", authHeader());

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/scan/:projectId/:deviceId/:scanId (DeleteScan)", () => {
  it("deletes an existing scan", async () => {
    await fake.collection("projects/proj-1/devices/dev-6/scans").doc("scan-8").set({ Status: "complete" });

    const app = buildApp();
    const res = await request(app).delete("/api/scan/proj-1/dev-6/scan-8").set("Authorization", authHeader());

    expect(res.status).toBe(204);
    expect(fake.peek("projects/proj-1/devices/dev-6/scans/scan-8")).toBeUndefined();
  });

  it("returns 404 for a scan that does not exist", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/scan/proj-1/dev-6/does-not-exist").set("Authorization", authHeader());
    expect(res.status).toBe(404);
  });

  it("denies deletion when the caller lacks Project.Scans.Delete on the project", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/scan/proj-other/dev-6/scan-8").set("Authorization", authHeader());
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/scan/:projectId/:deviceId/:scanId/status (UpdateScanStatus)", () => {
  it("updates status, requiring only authentication (no permission check, matching the old server)", async () => {
    await fake.collection("projects/proj-other/devices/dev-7/scans").doc("scan-9").set({ Status: "pending" });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/scan/proj-other/dev-7/scan-9/status")
      .set("Authorization", authHeader())
      .send({ Status: "running" });

    expect(res.status).toBe(204);
    const stored = fake.peek("projects/proj-other/devices/dev-7/scans/scan-9");
    expect(stored?.Status).toBe("running");
    expect(stored?.StartedAt).toBeTruthy();
  });

  it("stamps FinishedAt and stores ObjUrl on transition to complete", async () => {
    await fake.collection("projects/proj-1/devices/dev-8/scans").doc("scan-10").set({ Status: "running", InitiatedByUserId: "user-1" });

    const app = buildApp();
    const res = await request(app)
      .patch("/api/scan/proj-1/dev-8/scan-10/status")
      .set("Authorization", authHeader())
      .send({ Status: "complete", ObjUrl: "gs://bucket/scan-10.obj" });

    expect(res.status).toBe(204);
    const stored = fake.peek("projects/proj-1/devices/dev-8/scans/scan-10");
    expect(stored?.Status).toBe("complete");
    expect(stored?.ObjUrl).toBe("gs://bucket/scan-10.obj");
    expect(stored?.FinishedAt).toBeTruthy();
  });

  it("returns 404 for a scan that does not exist", async () => {
    const app = buildApp();
    const res = await request(app)
      .patch("/api/scan/proj-1/dev-8/does-not-exist/status")
      .set("Authorization", authHeader())
      .send({ Status: "running" });

    expect(res.status).toBe(404);
  });

  it("rejects requests with no Authorization header", async () => {
    const app = buildApp();
    const res = await request(app).patch("/api/scan/proj-1/dev-8/scan-10/status").send({ Status: "running" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/scan/:projectId/visualizer/latest (LoadLatestCompleteScanIntoVisualizer)", () => {
  it("returns no_devices when the project has no devices", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/scan/proj-1/visualizer/latest").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, reason: "no_devices" });
  });

  it("returns no_complete_scan when devices exist but none has a complete scan", async () => {
    await fake.collection("devices").doc("dev-9").set({ ProjectId: "proj-1", Name: "Jetson" });

    const app = buildApp();
    const res = await request(app).post("/api/scan/proj-1/visualizer/latest").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, reason: "no_complete_scan" });
  });

  it("resolves the latest complete scan but reports not_implemented (visualizer ingest not yet ported)", async () => {
    await fake.collection("devices").doc("dev-10").set({ ProjectId: "proj-1", Name: "Jetson" });
    await fake
      .collection("projects/proj-1/devices/dev-10/scans")
      .doc("scan-11")
      .set({ Status: "complete", FinishedAt: Timestamp.fromDate(new Date("2026-01-01T00:00:00Z")) });

    const app = buildApp();
    const res = await request(app).post("/api/scan/proj-1/visualizer/latest").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: false, reason: "not_implemented", deviceId: "dev-10" });
  });
});
