import { describe, expect, it, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
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

// The core algorithm has its own dedicated tests (fusionEngineService.test.ts) - here it's
// mocked out so route/orchestration tests don't touch real GCS/Firestore-backed logic.
const runFusionEngineMock = vi.fn(async () => ({ success: true, message: "" }));
const downloadGcsBytesMock = vi.fn(async () => Buffer.from('{"0":{"sources":[],"num_events":0,"tracks":[]}}'));
vi.mock("../services/fusionEngineService.js", () => ({
  runFusionEngine: (...args: unknown[]) => runFusionEngineMock(...args),
  downloadGcsBytes: (...args: unknown[]) => downloadGcsBytesMock(...args),
}));

const createSignedDownloadUrlMock = vi.fn(async (input: { PathFromRoot: string }) => ({
  PathFromRoot: input.PathFromRoot,
  SignedUrl: `https://signed.example/${input.PathFromRoot}`,
  ExpiresAt: new Date(),
}));
vi.mock("../services/cloudStorageService.js", () => ({
  createSignedDownloadUrl: (...args: unknown[]) => createSignedDownloadUrlMock(...args),
}));

// Not wired into app.ts yet (another migration step mounts it), so the test builds a minimal
// app around the router directly - same middleware stack app.ts uses (see scan.routes.test.ts).
const { fusionRouter } = await import("./fusion.routes.js");
const { errorHandler } = await import("../middleware/errorHandler.js");
const { createUserToken } = await import("../services/tokenService.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/fusion", fusionRouter);
  app.use(errorHandler);
  return app;
}

function authHeader(userId = "user-1"): string {
  const { token } = createUserToken({ Id: userId, Email: "a@b.com", Role: "User" } as never);
  return `Bearer ${token}`;
}

function flushMicrotasks(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  runFusionEngineMock.mockClear();
  runFusionEngineMock.mockImplementation(async () => ({ success: true, message: "" }));
  downloadGcsBytesMock.mockClear();
  createSignedDownloadUrlMock.mockClear();
  hasProjectPermission.mockClear();
});

describe("GET /api/fusion/history", () => {
  it("returns a project's runs sorted newest-first", async () => {
    await fake.collection("fusion_runs").doc("run-old").set({
      Status: "success",
      TriggeredBy: "manual",
      ProjectId: "proj-1",
      StartedAtUnix: 1000,
    });
    await fake.collection("fusion_runs").doc("run-new").set({
      Status: "running",
      TriggeredBy: "manual",
      ProjectId: "proj-1",
      StartedAtUnix: 2000,
    });
    await fake.collection("fusion_runs").doc("other-project").set({
      Status: "success",
      TriggeredBy: "manual",
      ProjectId: "proj-other",
      StartedAtUnix: 3000,
    });

    const app = buildApp();
    const res = await request(app).get("/api/fusion/history?projectId=proj-1").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body.map((r: { Id: string }) => r.Id)).toEqual(["run-new", "run-old"]);
    expect(res.body[0].Status).toBe("running");
  });

  it("returns 403 when projectId is missing (requirePermission can't resolve a project without it, matching PermissionAuthorizationHandler.ResolveProjectId)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/fusion/history").set("Authorization", authHeader());
    expect(res.status).toBe(403);
  });

  it("returns 403 when the caller lacks Project.Scans.Read on the project", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/fusion/history?projectId=proj-2").set("Authorization", authHeader());
    expect(res.status).toBe(403);
  });
});

describe("POST /api/fusion/trigger", () => {
  it("creates a running run row immediately and completes it via the (mocked) engine run in the background", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/fusion/trigger?projectId=proj-1")
      .set("Authorization", authHeader())
      .send({ FromDateUnix: 1700000000, ToDateUnix: 1700003600 });

    expect(res.status).toBe(200);
    expect(res.body.Status).toBe("running");
    expect(res.body.TriggeredBy).toBe("manual");
    expect(res.body.ProjectId).toBe("proj-1");
    expect(res.body.Id).toBeTruthy();

    await flushMicrotasks();

    expect(runFusionEngineMock).toHaveBeenCalledTimes(1);
    const [engineRequest] = runFusionEngineMock.mock.calls[0] as [{ inputStorageFolder: string; outputStorageFolder: string }];
    expect(engineRequest.inputStorageFolder).toBe("vision/tracks-raw/proj-1");
    expect(engineRequest.outputStorageFolder).toBe("vision/tracks-fused/proj-1");

    // The mocked engine run resolves near-instantly, so by the time we inspect the doc the
    // background job (see triggerFusion in fusionService.ts) has already written its terminal
    // state - FromDateUnix/ToDateUnix set at creation survive the later partial `update()`.
    const completed = fake.peek(`fusion_runs/${res.body.Id}`);
    expect(completed?.FromDateUnix).toBe(1700000000);
    expect(completed?.ToDateUnix).toBe(1700003600);
    expect(completed?.Status).toBe("success");
    expect(completed?.OutputGcsPath).toMatch(/^vision\/tracks-fused\/proj-1\/fused_tracks-\d{8}(_\d{8})?\.json$/);
  });

  it("marks the run failed when the engine run fails", async () => {
    runFusionEngineMock.mockImplementationOnce(async () => ({ success: false, message: "No track files found" }));

    const app = buildApp();
    const res = await request(app)
      .post("/api/fusion/trigger?projectId=proj-1")
      .set("Authorization", authHeader())
      .send({ FromDateUnix: 1700000000, ToDateUnix: 1700003600 });

    await flushMicrotasks();

    const completed = fake.peek(`fusion_runs/${res.body.Id}`);
    expect(completed?.Status).toBe("failed");
    expect(completed?.ErrorMessage).toBe("No track files found");
  });

  it("returns 400 when FromDateUnix is not before ToDateUnix", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/fusion/trigger?projectId=proj-1")
      .set("Authorization", authHeader())
      .send({ FromDateUnix: 1700003600, ToDateUnix: 1700000000 });
    expect(res.status).toBe(400);
    expect(runFusionEngineMock).not.toHaveBeenCalled();
  });

  it("returns 403 when projectId is missing (permission middleware can't resolve a project without it)", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/fusion/trigger")
      .set("Authorization", authHeader())
      .send({ FromDateUnix: 1700000000, ToDateUnix: 1700003600 });
    expect(res.status).toBe(403);
  });

  it("returns 403 when the caller lacks Project.Scans.Start on the project", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/fusion/trigger?projectId=proj-2")
      .set("Authorization", authHeader())
      .send({ FromDateUnix: 1700000000, ToDateUnix: 1700003600 });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/fusion/:runId", () => {
  it("deletes a run the caller is authorized for (via the run's own ProjectId)", async () => {
    await fake.collection("fusion_runs").doc("run-del").set({ Status: "success", ProjectId: "proj-1" });

    const app = buildApp();
    const res = await request(app).delete("/api/fusion/run-del").set("Authorization", authHeader());

    expect(res.status).toBe(204);
    expect(fake.peek("fusion_runs/run-del")).toBeUndefined();
  });

  it("returns 404 for a run that does not exist", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/fusion/does-not-exist").set("Authorization", authHeader());
    expect(res.status).toBe(404);
  });

  it("returns 403 when the run belongs to a project the caller lacks Project.Scans.Delete on", async () => {
    await fake.collection("fusion_runs").doc("run-other").set({ Status: "success", ProjectId: "proj-2" });

    const app = buildApp();
    const res = await request(app).delete("/api/fusion/run-other").set("Authorization", authHeader());
    expect(res.status).toBe(403);
  });

  it("returns 403 when the run has no ProjectId at all", async () => {
    await fake.collection("fusion_runs").doc("run-orphan").set({ Status: "success" });

    const app = buildApp();
    const res = await request(app).delete("/api/fusion/run-orphan").set("Authorization", authHeader());
    expect(res.status).toBe(403);
  });
});

describe("POST /api/fusion/:runId/cancel", () => {
  it("returns 202 cancelling and marks the run failed when a live run is cancelled", async () => {
    let capturedSignal: AbortSignal | undefined;
    runFusionEngineMock.mockImplementationOnce(
      (_req: unknown, opts?: { signal?: AbortSignal }) =>
        new Promise((resolve) => {
          capturedSignal = opts?.signal;
          opts?.signal?.addEventListener("abort", () => resolve({ success: false, message: "aborted" }));
        }),
    );

    const app = buildApp();
    const triggerRes = await request(app)
      .post("/api/fusion/trigger?projectId=proj-1")
      .set("Authorization", authHeader())
      .send({ FromDateUnix: 1700000000, ToDateUnix: 1700003600 });
    const runId = triggerRes.body.Id;
    await flushMicrotasks(5); // let the mocked engine call start and register the signal

    const cancelRes = await request(app).post(`/api/fusion/${runId}/cancel`).set("Authorization", authHeader());
    expect(cancelRes.status).toBe(202);
    expect(cancelRes.body).toEqual({ status: "cancelling" });

    const stored = fake.peek(`fusion_runs/${runId}`);
    expect(stored?.Status).toBe("failed");
    expect(stored?.ErrorMessage).toBe("Cancelled by user");
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("returns 200 cancelled (stale) when the run is marked running but has no live registration", async () => {
    await fake.collection("fusion_runs").doc("run-stale").set({ Status: "running", ProjectId: "proj-1" });

    const app = buildApp();
    const res = await request(app).post("/api/fusion/run-stale/cancel").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "cancelled" });
    expect(fake.peek("fusion_runs/run-stale")?.Status).toBe("failed");
  });

  it("returns 409 when the run is not in a running state", async () => {
    await fake.collection("fusion_runs").doc("run-done").set({ Status: "success", ProjectId: "proj-1" });

    const app = buildApp();
    const res = await request(app).post("/api/fusion/run-done/cancel").set("Authorization", authHeader());

    expect(res.status).toBe(409);
  });

  it("returns 404 for a run that does not exist", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/fusion/does-not-exist/cancel").set("Authorization", authHeader());
    expect(res.status).toBe(404);
  });
});

describe("GET /api/fusion/:runId/download-url", () => {
  it("returns a signed download URL for a completed run", async () => {
    await fake.collection("fusion_runs").doc("run-ok").set({
      Status: "success",
      ProjectId: "proj-1",
      OutputGcsPath: "vision/tracks-fused/proj-1/fused_tracks-20250101.json",
    });

    const app = buildApp();
    const res = await request(app).get("/api/fusion/run-ok/download-url").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body.url).toContain("vision/tracks-fused/proj-1/fused_tracks-20250101.json");
    expect(createSignedDownloadUrlMock).toHaveBeenCalledWith({
      PathFromRoot: "vision/tracks-fused/proj-1/fused_tracks-20250101.json",
    });
  });

  it("returns 404 when the run has no output file yet", async () => {
    await fake.collection("fusion_runs").doc("run-pending").set({ Status: "running", ProjectId: "proj-1" });

    const app = buildApp();
    const res = await request(app).get("/api/fusion/run-pending/download-url").set("Authorization", authHeader());
    expect(res.status).toBe(404);
  });
});

describe("GET /api/fusion/:runId/download", () => {
  it("streams the fused output JSON as an attachment", async () => {
    await fake.collection("fusion_runs").doc("run-dl").set({
      Status: "success",
      ProjectId: "proj-1",
      OutputGcsPath: "vision/tracks-fused/proj-1/fused_tracks-20250101.json",
    });

    const app = buildApp();
    const res = await request(app).get("/api/fusion/run-dl/download").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.headers["content-disposition"]).toContain("fused_tracks-20250101.json");
    expect(downloadGcsBytesMock).toHaveBeenCalledWith("vision/tracks-fused/proj-1/fused_tracks-20250101.json");
  });

  it("returns 404 when the run has no output file", async () => {
    await fake.collection("fusion_runs").doc("run-nofile").set({ Status: "failed", ProjectId: "proj-1" });

    const app = buildApp();
    const res = await request(app).get("/api/fusion/run-nofile/download").set("Authorization", authHeader());
    expect(res.status).toBe(404);
  });
});

describe("GET /api/fusion/config", () => {
  it("returns default schedule settings when no config doc exists", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/fusion/config?projectId=proj-1").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ScheduledHourUtc: 21, ScheduledMinuteUtc: 0, Enabled: true, ProjectId: "proj-1" });
  });

  it("returns the stored config when a doc exists", async () => {
    await fake.collection("fusion_config").doc("proj-1").set({
      ScheduledHourUtc: 3,
      ScheduledMinuteUtc: 30,
      Enabled: false,
      ProjectId: "proj-1",
    });

    const app = buildApp();
    const res = await request(app).get("/api/fusion/config?projectId=proj-1").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ScheduledHourUtc: 3, ScheduledMinuteUtc: 30, Enabled: false, ProjectId: "proj-1" });
  });

  it("returns 403 when projectId is missing (permission middleware can't resolve a project without it)", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/fusion/config").set("Authorization", authHeader());
    expect(res.status).toBe(403);
  });

  it("returns 403 when the caller lacks Project.ScanSchedules.Read on the project", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/fusion/config?projectId=proj-2").set("Authorization", authHeader());
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/fusion/config", () => {
  it("stores the schedule, using the query projectId even if the body sends a different one", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/fusion/config?projectId=proj-1")
      .set("Authorization", authHeader())
      .send({ ScheduledHourUtc: 5, ScheduledMinuteUtc: 45, Enabled: false, ProjectId: "someone-elses-project" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ScheduledHourUtc: 5, ScheduledMinuteUtc: 45, Enabled: false, ProjectId: "proj-1" });

    const stored = fake.peek("fusion_config/proj-1");
    expect(stored?.ScheduledHourUtc).toBe(5);
    expect(stored?.ProjectId).toBe("proj-1");
  });

  it("returns 400 for an out-of-range hour", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/fusion/config?projectId=proj-1")
      .set("Authorization", authHeader())
      .send({ ScheduledHourUtc: 24, ScheduledMinuteUtc: 0, Enabled: true });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an out-of-range minute", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/fusion/config?projectId=proj-1")
      .set("Authorization", authHeader())
      .send({ ScheduledHourUtc: 10, ScheduledMinuteUtc: 60, Enabled: true });
    expect(res.status).toBe(400);
  });

  it("returns 403 when projectId is missing (permission middleware can't resolve a project without it)", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/fusion/config")
      .set("Authorization", authHeader())
      .send({ ScheduledHourUtc: 10, ScheduledMinuteUtc: 0, Enabled: true });
    expect(res.status).toBe(403);
  });

  it("returns 403 when the caller lacks Project.ScanSchedules.Manage on the project", async () => {
    const app = buildApp();
    const res = await request(app)
      .put("/api/fusion/config?projectId=proj-2")
      .set("Authorization", authHeader())
      .send({ ScheduledHourUtc: 10, ScheduledMinuteUtc: 0, Enabled: true });
    expect(res.status).toBe(403);
  });
});

describe("authentication", () => {
  it("rejects every route without a bearer token", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/fusion/history?projectId=proj-1");
    expect(res.status).toBe(401);
  });
});
