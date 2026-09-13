import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * trackingRouter is not yet mounted in app.ts (that's a separate wiring step,
 * out of scope for this port - see tracking.routes.ts), so unlike
 * device.routes.test.ts / project.routes.test.ts this builds a minimal app
 * that mounts just the router under the prefix it will eventually get in
 * app.ts, plus the same JSON body parser and error handler createApp() uses.
 *
 * TRACKING_POSITIONS_CSV / TRACKING_TRACKS_DIR must be set before env.ts (and
 * anything importing it) is first loaded, since config/env.ts snapshots
 * process.env into a static object at import time. Both point at a temp
 * directory for the lifetime of this file; individual tests write/overwrite
 * the fixture files inside it.
 */
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracking-test-"));
const positionsCsv = path.join(tmpDir, "positions.csv");
const tracksDir = path.join(tmpDir, "tracks");
fs.mkdirSync(tracksDir);
process.env.TRACKING_POSITIONS_CSV = positionsCsv;
process.env.TRACKING_TRACKS_DIR = tracksDir;

const { trackingRouter } = await import("./tracking.routes.js");
const { errorHandler } = await import("../middleware/errorHandler.js");
const { createUserToken } = await import("../services/tokenService.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/tracking", trackingRouter);
  app.use(errorHandler);
  return app;
}

function authHeader(): string {
  const { token } = createUserToken({ Id: "user-1", Email: "a@b.com", Role: "User" } as never);
  return `Bearer ${token}`;
}

function writeCsv(lines: string[]) {
  fs.writeFileSync(positionsCsv, lines.join("\n"));
}

function writeTrack(fileName: string, data: Record<string, unknown>) {
  fs.writeFileSync(path.join(tracksDir, fileName), JSON.stringify(data));
}

function clearTracks() {
  for (const f of fs.readdirSync(tracksDir)) {
    fs.rmSync(path.join(tracksDir, f));
  }
}

beforeEach(() => {
  clearTracks();
  if (fs.existsSync(positionsCsv)) fs.rmSync(positionsCsv);
});

afterEach(() => {
  clearTracks();
  if (fs.existsSync(positionsCsv)) fs.rmSync(positionsCsv);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /api/tracking/positions", () => {
  it("401s without a bearer token", async () => {
    const res = await request(buildApp()).get("/api/tracking/positions");
    expect(res.status).toBe(401);
  });

  it("parses the CSV, newest-first-read but returned in original file order, honoring ?limit", async () => {
    writeCsv([
      "global_id,camera_id,frame_idx,timestamp,x_ground,y_ground,x1,y1,x2,y2,confidence",
      "1,cam1,10,2024-01-01T00:00:00.000Z,0.5,0.6,10,20,30,40,0.9",
      "2,cam1,11,2024-01-01T00:00:01.000Z,,,11,21,31,41,0.8",
      "3,cam1,12,2024-01-01T00:00:02.000Z,0.7,0.8,12,22,32,42,0.95",
    ]);

    const res = await request(buildApp()).get("/api/tracking/positions").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((p: { GlobalId: number }) => p.GlobalId)).toEqual([1, 2, 3]);
    expect(res.body[0].XGround).toBe(0.5);
    // Blank x_ground/y_ground fields parse leniently to null, not a dropped line.
    expect(res.body[1].XGround).toBeNull();
    expect(res.body[1].YGround).toBeNull();

    const limited = await request(buildApp())
      .get("/api/tracking/positions?limit=2")
      .set("Authorization", authHeader());
    expect(limited.body.map((p: { GlobalId: number }) => p.GlobalId)).toEqual([2, 3]);
  });

  it("returns an empty array when the CSV file doesn't exist", async () => {
    const res = await request(buildApp()).get("/api/tracking/positions").set("Authorization", authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/tracking/tracks", () => {
  it("401s without a bearer token", async () => {
    const res = await request(buildApp()).get("/api/tracking/tracks");
    expect(res.status).toBe(401);
  });

  it("loads every *.json file in the tracks dir and transforms positions to lidar space", async () => {
    writeTrack("track-1.json", {
      global_id: 7,
      local_cam: "cam1",
      first_seen_frame: 0,
      last_seen_frame: 5,
      positions: [
        [0, "2024-01-01T00:00:00.000Z", 0, 0, 2, 3],
        [0, "2024-01-01T00:00:01.000Z", 0, 0, 4, 5],
      ],
    });

    const res = await request(buildApp()).get("/api/tracking/tracks").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].GlobalId).toBe(7);
    expect(res.body[0].NumDetections).toBe(2);
    // Default Tracking:Offset/Scale/Rotation are all identity (0/1/0), so the
    // transform reduces to X=xGround, Y=offsetY(0), Z=yGround.
    expect(res.body[0].Points[0].Position).toEqual({ X: 2, Y: 0, Z: 3 });
  });

  it("skips a track file with zero valid positions rather than failing the request", async () => {
    writeTrack("empty.json", {
      global_id: 9,
      local_cam: "cam1",
      first_seen_frame: 0,
      last_seen_frame: 0,
      positions: [],
    });

    const res = await request(buildApp()).get("/api/tracking/tracks").set("Authorization", authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/tracking/tracks/:globalId", () => {
  it("401s without a bearer token", async () => {
    const res = await request(buildApp()).get("/api/tracking/tracks/7");
    expect(res.status).toBe(401);
  });

  it("returns the matching track", async () => {
    writeTrack("track-7.json", {
      global_id: 7,
      local_cam: "cam1",
      first_seen_frame: 0,
      last_seen_frame: 1,
      positions: [[0, "2024-01-01T00:00:00.000Z", 0, 0, 1, 1]],
    });

    const res = await request(buildApp()).get("/api/tracking/tracks/7").set("Authorization", authHeader());
    expect(res.status).toBe(200);
    expect(res.body.GlobalId).toBe(7);
  });

  it("404s with an error body for a well-formed id that doesn't exist", async () => {
    const res = await request(buildApp()).get("/api/tracking/tracks/404").set("Authorization", authHeader());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Track with global ID 404 not found" });
  });

  it("404s with no body for a non-integer id (mirrors the {globalId:int} route constraint)", async () => {
    const res = await request(buildApp()).get("/api/tracking/tracks/not-a-number").set("Authorization", authHeader());
    expect(res.status).toBe(404);
    expect(res.body).toEqual({});
  });
});

describe("GET /api/tracking/active", () => {
  it("401s without a bearer token", async () => {
    const res = await request(buildApp()).get("/api/tracking/active");
    expect(res.status).toBe(401);
  });

  it("includes a track only when it has a recent EndTime AND a recent, grounded position", async () => {
    const now = new Date();
    const recentIso = now.toISOString();
    const staleIso = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    writeTrack("recent.json", {
      global_id: 1,
      local_cam: "cam1",
      first_seen_frame: 0,
      last_seen_frame: 1,
      positions: [[0, recentIso, 0, 0, 5, 6]],
    });
    writeTrack("stale.json", {
      global_id: 2,
      local_cam: "cam1",
      first_seen_frame: 0,
      last_seen_frame: 1,
      positions: [[0, staleIso, 0, 0, 5, 6]],
    });
    writeCsv([
      "global_id,camera_id,frame_idx,timestamp,x_ground,y_ground,x1,y1,x2,y2,confidence",
      `1,cam1,0,${recentIso},1.5,2.5,1,1,2,2,0.9`,
      `2,cam1,0,${staleIso},1.5,2.5,1,1,2,2,0.9`,
    ]);

    const res = await request(buildApp()).get("/api/tracking/active").set("Authorization", authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        globalId: 1,
        latestPosition: {
          xGround: 1.5,
          yGround: 2.5,
          timestamp: recentIso,
        },
      },
    ]);
  });

  it("respects ?seconds to widen/narrow the activity window", async () => {
    const staleIso = new Date(Date.now() - 60 * 1000).toISOString();
    writeTrack("borderline.json", {
      global_id: 5,
      local_cam: "cam1",
      first_seen_frame: 0,
      last_seen_frame: 1,
      positions: [[0, staleIso, 0, 0, 5, 6]],
    });
    writeCsv([
      "global_id,camera_id,frame_idx,timestamp,x_ground,y_ground,x1,y1,x2,y2,confidence",
      `5,cam1,0,${staleIso},1.5,2.5,1,1,2,2,0.9`,
    ]);

    const tooNarrow = await request(buildApp()).get("/api/tracking/active?seconds=10").set("Authorization", authHeader());
    expect(tooNarrow.body).toEqual([]);

    const wideEnough = await request(buildApp()).get("/api/tracking/active?seconds=120").set("Authorization", authHeader());
    expect(wideEnough.body).toHaveLength(1);
    expect(wideEnough.body[0].globalId).toBe(5);
  });
});
