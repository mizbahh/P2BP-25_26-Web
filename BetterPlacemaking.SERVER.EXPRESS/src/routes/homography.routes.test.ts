import { beforeEach, describe, expect, it, vi } from "vitest";
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

const { homographyRouter } = await import("./homography.routes.js");
const { errorHandler } = await import("../middleware/errorHandler.js");
const { createUserToken } = await import("../services/tokenService.js");
const { computeApiKeyHash } = await import("../middleware/requireDeviceApiKey.js");
const { flattenMatrix3x3, unflattenMatrix3x3 } = await import("../models/homography.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/homography", homographyRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

function authHeader(userId = "user-1"): string {
  const { token } = createUserToken({ Id: userId, Email: "a@b.com", Role: "User" } as never);
  return `Bearer ${token}`;
}

const DEVICE_KEY = "raw-device-api-key";

beforeEach(() => {
  fake.collection("devices").doc("dev-1").set({
    ApiKeyHash: computeApiKeyHash(DEVICE_KEY),
    ProjectId: "proj-1",
    Nickname: "Jetson 1",
  });
});

const validLocalDto = {
  CameraMac: "AA:BB:CC:DD:EE:FF",
  Matrix: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  FrameSize: [1920, 1080],
  Inliers: 40,
  RmseBoard: 0.3,
  CornersUsed: 24,
  MarkersDetected: 12,
  ArucoDict: "DICT_4X4_50",
  SquaresX: 5,
  SquaresY: 7,
  SquareLength: 0.04,
  MarkerLength: 0.02,
  TimestampUnix: 1_700_000_000,
};

// ---------------------------------------------------------------------------
// Matrix helpers - the numeric plumbing every other endpoint depends on.
// ---------------------------------------------------------------------------
describe("matrix flatten/unflatten round trip", () => {
  it("flattens row-major and restores the same matrix", () => {
    const m = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];

    expect(flattenMatrix3x3(m)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(unflattenMatrix3x3(flattenMatrix3x3(m))).toEqual(m);
  });

  it("returns null for absent input rather than a malformed matrix", () => {
    expect(flattenMatrix3x3(null)).toBeNull();
    expect(unflattenMatrix3x3(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Device-authenticated endpoints (DeviceApiKey policy).
// ---------------------------------------------------------------------------
describe("POST /api/homography/submit-local", () => {
  it("rejects a request with no device API key", async () => {
    const res = await request(app).post("/api/homography/submit-local").send(validLocalDto);
    expect(res.status).toBe(401);
  });

  it("rejects an unknown device API key", async () => {
    const res = await request(app)
      .post("/api/homography/submit-local")
      .set("Authorization", "Bearer not-a-real-key")
      .send(validLocalDto);
    expect(res.status).toBe(401);
  });

  it("stores the local homography under {deviceId}_{normalizedMac}", async () => {
    const res = await request(app)
      .post("/api/homography/submit-local")
      .set("Authorization", `Bearer ${DEVICE_KEY}`)
      .send(validLocalDto);

    expect(res.status).toBe(200);
    expect(res.body.CameraMac).toBeTruthy();
    expect(res.body.HomographyId).toContain("dev-1");
  });

  it("rejects an empty payload", async () => {
    const res = await request(app)
      .post("/api/homography/submit-local")
      .set("Authorization", `Bearer ${DEVICE_KEY}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.text).toBe("Invalid payload.");
  });

  it("rejects a payload missing the Matrix", async () => {
    const { Matrix: _omitted, ...withoutMatrix } = validLocalDto;
    const res = await request(app)
      .post("/api/homography/submit-local")
      .set("Authorization", `Bearer ${DEVICE_KEY}`)
      .send(withoutMatrix);

    expect(res.status).toBe(400);
    expect(res.text).toBe("Invalid payload.");
  });
});

describe("POST /api/homography/submit-sightings", () => {
  it("rejects a request with no device API key", async () => {
    const res = await request(app)
      .post("/api/homography/submit-sightings")
      .send({ CameraMac: "AA:BB:CC:DD:EE:FF", ArucoDict: "DICT_4X4_50", CapturedAt: "2026-01-01T00:00:00Z", Markers: [] });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// User-authenticated endpoints (UserJwt policy).
// ---------------------------------------------------------------------------
describe("GET /api/homography/has-local/:deviceId", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/homography/has-local/dev-1");
    expect(res.status).toBe(401);
  });

  it("reports false for a device with no stored homography", async () => {
    const res = await request(app).get("/api/homography/has-local/dev-unknown").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ HasLocalHomography: false });
  });

  it("reports true once a local homography exists", async () => {
    await request(app)
      .post("/api/homography/submit-local")
      .set("Authorization", `Bearer ${DEVICE_KEY}`)
      .send(validLocalDto);

    const res = await request(app).get("/api/homography/has-local/dev-1").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ HasLocalHomography: true });
  });
});

describe("GET /api/homography/intrinsics/:deviceId/:mac", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/homography/intrinsics/dev-1/AA:BB:CC:DD:EE:FF");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the device/camera has no stored intrinsics", async () => {
    const res = await request(app)
      .get("/api/homography/intrinsics/dev-unknown/AA:BB:CC:DD:EE:FF")
      .set("Authorization", authHeader());

    expect(res.status).toBe(404);
    expect(res.text).toBe("No intrinsics found for the given device and camera.");
  });
});

describe("GET /api/homography/session-status/:sessionId", () => {
  it("returns 404 for an unknown session (KeyNotFoundException -> NotFound)", async () => {
    const res = await request(app).get("/api/homography/session-status/no-such-session").set("Authorization", authHeader());

    expect(res.status).toBe(404);
    expect(res.text).toMatch(/not found/i);
  });
});

describe("GET /api/homography/snapshot-url/:deviceId/:cameraMac", () => {
  it("returns 200 with a null url when no snapshot is stored, not a 404", async () => {
    const res = await request(app)
      .get("/api/homography/snapshot-url/dev-unknown/AA:BB:CC:DD:EE:FF")
      .set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ SnapshotUrl: null });
  });
});

describe("POST /api/homography/compute-lock", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/homography/compute-lock");
    expect(res.status).toBe(401);
  });

  it("maps a lock failure to 422, matching UnprocessableEntity(ex.Message)", async () => {
    // No ArUco sightings have been recorded, so runBfsLock throws the
    // InvalidOperationException-equivalent HomographyLockError.
    const res = await request(app).post("/api/homography/compute-lock").set("Authorization", authHeader());

    expect(res.status).toBe(422);
    expect(res.text).toMatch(/sightings|cameras/i);
  });
});

// ---------------------------------------------------------------------------
// Project-scoped workspace endpoints (UserJwt + [RequirePermission]).
// ---------------------------------------------------------------------------
describe("GET /api/homography/workspace/:projectId", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/homography/workspace/proj-1");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a project the caller has no permission on", async () => {
    const res = await request(app).get("/api/homography/workspace/proj-other").set("Authorization", authHeader());
    expect(res.status).toBe(403);
  });

  it("returns the workspace for a permitted project", async () => {
    const res = await request(app).get("/api/homography/workspace/proj-1").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(hasProjectPermission).toHaveBeenCalled();
    expect(res.body).toHaveProperty("PuzzlePieces");
  });
});

describe("POST /api/homography/workspace/:projectId/puzzle-pieces/refresh", () => {
  it("returns 403 without Project.Update on that project", async () => {
    const res = await request(app)
      .post("/api/homography/workspace/proj-other/puzzle-pieces/refresh")
      .set("Authorization", authHeader());

    expect(res.status).toBe(403);
  });
});

describe("GET /api/homography/workspace/:projectId/puzzle-pieces/:deviceId/:cameraMac", () => {
  it("returns 404 when the device has no local homography (KeyNotFoundException -> NotFound)", async () => {
    const res = await request(app)
      .get("/api/homography/workspace/proj-1/puzzle-pieces/dev-unknown/AA:BB:CC:DD:EE:FF")
      .set("Authorization", authHeader());

    expect(res.status).toBe(404);
  });
});

describe("POST /api/homography/workspace/:projectId/global-homographies", () => {
  it("returns 403 without Project.Update on that project", async () => {
    const res = await request(app)
      .post("/api/homography/workspace/proj-other/global-homographies")
      .set("Authorization", authHeader())
      .send({ MmPerFpPx: 1, Placements: [] });

    expect(res.status).toBe(403);
  });

  it("maps a validation failure to 400 (ArgumentException -> BadRequest)", async () => {
    const res = await request(app)
      .post("/api/homography/workspace/proj-1/global-homographies")
      .set("Authorization", authHeader())
      .send({ MmPerFpPx: 0, Placements: [] });

    expect(res.status).toBe(400);
    expect(res.text).toMatch(/MmPerFpPx/);
  });
});
