import { describe, expect, it } from "vitest";
import {
  Kalman2D,
  averageReps,
  cleanTrack,
  cosineSimilarity,
  exportFusionResult,
  mean,
  parseIntrinsicsYaml,
  runFusion,
  undistortPoint,
} from "./fusionEngineService.js";
import type { FusedIdentity, TrackEvent, TrackObject } from "../models/fusion.js";

/**
 * Ported-algorithm tests for fusionEngineService.ts (FusionEngine.cs). The focus, per the
 * porting brief, is the core fusion/matching decision (runFusion / TeleportMetrics /
 * TimeCompatible) and track cleaning (TrackCleaner.Clean) - every scenario below is hand-computed
 * against the real thresholds in FusionEngineConfig (SimThreshold=0.75, MaxSpeedWorldPerS=8000,
 * MaxJumpFusion=30000, MaxGapMs=12000, MinTrackPoints=8, MinDurationS=1.0, MaxJumpClean=6000,
 * DupEps=1e-3, SmoothWin=2), not just "it runs".
 *
 * NOTE on FusionEngine.Overlaps (the "same camera, overlapping time window" rejection): given
 * TeleportMetrics rejects any candidate with dtMs <= 0 *before* Overlaps() is ever reached, and a
 * gid's TEnd is updated to the newly-merged track's TEnd on every merge (which, given the dtMs>0
 * requirement and TStart<=TEnd for any valid track, is always strictly greater than the gid's
 * previous TEnd) - a gid's TEnd is strictly increasing across merges. That means any candidate
 * track reaching the Overlaps() check already has TStart > every previously-recorded segment's
 * TEnd, so `track.TStart <= segEnd` can never hold and Overlaps() can never return true. This
 * appears to be dead code in the C# source as literally written (ported faithfully below anyway,
 * per the porting brief's "do not reinterpret" instruction) - flagged here rather than silently
 * worked around, and no test asserts on it since no input can exercise a `true` return from it.
 */

function ev(x: number, y: number, time: number, cam: string, sid: number): TrackEvent {
  return { x, y, time, cam, sid };
}

function track(cam: string, sid: number, rep: number[], events: TrackEvent[]): TrackObject {
  return {
    cam,
    sid,
    rep,
    tStart: events[0].time,
    tEnd: events[events.length - 1].time,
    x: events[events.length - 1].x,
    y: events[events.length - 1].y,
    events,
  };
}

// ─────────────────────────────────────────────
// VectorMath
// ─────────────────────────────────────────────

describe("cosineSimilarity", () => {
  it("returns 1 for identical unit vectors", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 12);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 12);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 1], [-1, -1])).toBeCloseTo(-1, 12);
  });

  it("throws on mismatched lengths", () => {
    expect(() => cosineSimilarity([1, 0], [1, 0, 0])).toThrow("Vectors must be same length");
  });

  it("returns 0 when either vector has ~zero norm (denom < 1e-9 guard)", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe("mean / averageReps", () => {
  it("mean averages component-wise", () => {
    expect(mean([[1, 2], [3, 4], [5, 6]])).toEqual([3, 4]);
  });

  it("averageReps averages two vectors component-wise", () => {
    expect(averageReps([1, 0], [0.8, 0.6])).toEqual([0.9, 0.3]);
  });
});

// ─────────────────────────────────────────────
// Core fusion/matching algorithm (FusionEngine.Run)
// ─────────────────────────────────────────────

describe("runFusion - merge decisions", () => {
  it("merges a high-similarity, close, time-compatible track into a new gid, averaging rep", () => {
    const seed = track("camA", 1, [1, 0], [ev(1000, 1000, 0, "camA", 1), ev(1000, 1000, 5000, "camA", 1)]);
    // dist from gid (1000,1000) to (1100,1000) = 100mm; dtMs = 6000-5000 = 1000ms; speed=100mm/s.
    const next = track("camB", 7, [0.8, 0.6], [ev(1100, 1000, 6000, "camB", 7), ev(1200, 1000, 8000, "camB", 7)]);

    const gids = runFusion([seed, next]);

    expect(gids).toHaveLength(1);
    expect(gids[0].sources).toEqual([
      { cam: "camA", sid: 1 },
      { cam: "camB", sid: 7 },
    ]);
    expect(gids[0].rep).toEqual([0.9, 0.3]); // averageReps([1,0],[0.8,0.6])
    expect(gids[0].tEnd).toBe(8000);
    expect(gids[0].x).toBe(1200);
    expect(gids[0].y).toBe(1000);
    expect(gids[0].tracks).toHaveLength(1);
    expect(gids[0].tracks[0].map((e) => e.time)).toEqual([0, 5000, 6000, 8000]);
  });

  it("keeps tracks separate when cosine similarity is below SimThreshold (0.75)", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, 0, "camA", 1), ev(0, 0, 1000, "camA", 1)]);
    // sim([1,0],[0.6,0.8]) = 0.6 < 0.75; position/speed are otherwise trivially compatible.
    const next = track("camB", 2, [0.6, 0.8], [ev(10, 0, 2000, "camB", 2), ev(10, 0, 3000, "camB", 2)]);

    const gids = runFusion([seed, next]);

    expect(gids).toHaveLength(2);
    expect(gids[0].sources).toEqual([{ cam: "camA", sid: 1 }]);
    expect(gids[1].sources).toEqual([{ cam: "camB", sid: 2 }]);
  });

  it("merges when similarity is safely above threshold (0.8)", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, 0, "camA", 1), ev(0, 0, 1000, "camA", 1)]);
    const next = track("camB", 2, [0.8, 0.6], [ev(10, 0, 2000, "camB", 2), ev(10, 0, 3000, "camB", 2)]);

    expect(runFusion([seed, next])).toHaveLength(1);
  });
});

describe("runFusion - speed/teleport gate (MaxSpeedWorldPerS = 8000 mm/s)", () => {
  it("merges at exactly the speed boundary (dist=8000mm over dt=1000ms => speed=8000, not > 8000)", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, -1000, "camA", 1), ev(0, 0, 0, "camA", 1)]);
    const next = track("camB", 2, [0.8, 0.6], [ev(8000, 0, 1000, "camB", 2), ev(8000, 0, 2000, "camB", 2)]);

    expect(runFusion([seed, next])).toHaveLength(1);
  });

  it("rejects just past the speed boundary (dist=8001mm over dt=1000ms => speed=8001 > 8000)", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, -1000, "camA", 1), ev(0, 0, 0, "camA", 1)]);
    const next = track("camB", 2, [0.8, 0.6], [ev(8001, 0, 1000, "camB", 2), ev(8001, 0, 2000, "camB", 2)]);

    expect(runFusion([seed, next])).toHaveLength(2);
  });
});

describe("runFusion - hard distance cap (MaxJumpFusion = 30000mm), independent of speed", () => {
  it("merges at exactly the cap (dist=30000mm, dt=4000ms => speed=7500mm/s, not > 30000)", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, 0, "camA", 1), ev(0, 0, 0, "camA", 1)]);
    const next = track("camB", 2, [0.8, 0.6], [ev(30000, 0, 4000, "camB", 2), ev(30000, 0, 5000, "camB", 2)]);

    expect(runFusion([seed, next])).toHaveLength(1);
  });

  it("rejects just past the cap even though implied speed is well under MaxSpeedWorldPerS", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, 0, "camA", 1), ev(0, 0, 0, "camA", 1)]);
    // dist=30001mm > 30000 cap; speed = 30001/4 = 7500.25mm/s, which alone would pass the speed
    // gate - this isolates the hard cap as an independent rejection reason.
    const next = track("camB", 2, [0.8, 0.6], [ev(30001, 0, 4000, "camB", 2), ev(30001, 0, 5000, "camB", 2)]);

    expect(runFusion([seed, next])).toHaveLength(2);
  });
});

describe("runFusion - time gap gate (MaxGapMs = 12000ms), independent of speed", () => {
  it("merges at exactly the gap boundary (12000ms)", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, 0, "camA", 1), ev(0, 0, 0, "camA", 1)]);
    const next = track("camB", 2, [0.8, 0.6], [ev(100, 0, 12000, "camB", 2), ev(100, 0, 13000, "camB", 2)]);

    expect(runFusion([seed, next])).toHaveLength(1);
  });

  it("rejects just past the gap boundary even though speed/distance are trivially compatible", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, 0, "camA", 1), ev(0, 0, 0, "camA", 1)]);
    // gap=12001ms; speed = 100/12.001 ≈ 8.33mm/s, nowhere near the speed cap - this isolates
    // TimeCompatible as a gate distinct from TeleportMetrics's own speed check.
    const next = track("camB", 2, [0.8, 0.6], [ev(100, 0, 12001, "camB", 2), ev(100, 0, 13000, "camB", 2)]);

    expect(runFusion([seed, next])).toHaveLength(2);
  });
});

describe("runFusion - non-positive gap is always a teleport (dtMs <= 0)", () => {
  it("rejects a simultaneous start (dtMs === 0) even with identical position and rep", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, 0, "camA", 1), ev(0, 0, 1000, "camA", 1)]);
    const next = track("camB", 2, [1, 0], [ev(0, 0, 1000, "camB", 2), ev(0, 0, 1000, "camB", 2)]);

    expect(runFusion([seed, next])).toHaveLength(2);
  });

  it("rejects a time-inverted start (dtMs < 0)", () => {
    const seed = track("camA", 1, [1, 0], [ev(0, 0, 0, "camA", 1), ev(0, 0, 1000, "camA", 1)]);
    const next = track("camB", 2, [1, 0], [ev(0, 0, 500, "camB", 2), ev(0, 0, 500, "camB", 2)]);

    expect(runFusion([seed, next])).toHaveLength(2);
  });
});

describe("runFusion - picks the best (highest-similarity) candidate, not the first valid one", () => {
  it("merges the new track into the higher-similarity gid even when it was created earlier", () => {
    // gid created first (index 0) has the LOWER similarity to the incoming track - a
    // first-match-wins implementation would incorrectly pick this one.
    const lowSimSeed = track("cam1", 1, [0.8, 0.6, 0], [ev(0, 0, 0, "cam1", 1), ev(0, 0, 1000, "cam1", 1)]);
    // gid created second (index 1) has the HIGHER similarity (sim=1.0).
    const highSimSeed = track("cam2", 2, [1, 0, 0], [ev(0, 0, 0, "cam2", 2), ev(0, 0, 1000, "cam2", 2)]);
    // Equidistant from both gids (same position/time gap for both), so similarity is the sole
    // differentiator: sim vs lowSimSeed = 0.8, sim vs highSimSeed = 1.0.
    const incoming = track("cam3", 3, [1, 0, 0], [ev(50, 0, 1500, "cam3", 3), ev(100, 0, 2000, "cam3", 3)]);

    const gids = runFusion([lowSimSeed, highSimSeed, incoming]);

    expect(gids).toHaveLength(2);
    const merged = gids.find((g) => g.sources.length === 2);
    const untouched = gids.find((g) => g.sources.length === 1);
    expect(merged?.sources).toEqual([
      { cam: "cam2", sid: 2 },
      { cam: "cam3", sid: 3 },
    ]);
    expect(untouched?.sources).toEqual([{ cam: "cam1", sid: 1 }]);
    expect(merged?.rep).toEqual([1, 0, 0]); // averageReps([1,0,0],[1,0,0])
  });
});

// ─────────────────────────────────────────────
// Track cleaning (TrackCleaner.Clean)
// ─────────────────────────────────────────────

describe("cleanTrack", () => {
  it("returns null for an empty track", () => {
    expect(cleanTrack([])).toBeNull();
  });

  it("returns null when fewer than MinTrackPoints (8) survive cleaning", () => {
    const short: TrackEvent[] = [];
    for (let i = 0; i < 7; i++) short.push(ev(i * 10, 0, i * 1000, "camA", 1));
    expect(cleanTrack(short)).toBeNull();
  });

  it("returns null when total duration is under MinDurationS (1.0s) even with enough points", () => {
    const brief: TrackEvent[] = [];
    for (let i = 0; i < 8; i++) brief.push(ev(i * 10, 0, i * 100, "camA", 1)); // spans 700ms < 1000ms
    expect(cleanTrack(brief)).toBeNull();
  });

  it("collapses near-duplicate consecutive points within DupEps (1e-3)", () => {
    const points: TrackEvent[] = [
      ev(0, 0, 0, "camA", 1),
      ev(0.0001, 0.0001, 500, "camA", 1), // within DupEps of previous - dropped
      ev(10, 0, 1000, "camA", 1),
      ev(20, 0, 2000, "camA", 1),
      ev(30, 0, 3000, "camA", 1),
      ev(40, 0, 4000, "camA", 1),
      ev(50, 0, 5000, "camA", 1),
      ev(60, 0, 6000, "camA", 1),
      ev(70, 0, 7000, "camA", 1),
    ];
    const cleaned = cleanTrack(points);
    expect(cleaned).not.toBeNull();
    // 9 input points minus 1 duplicate = 8 survive removeDuplicates/removeLargeJumps.
    expect(cleaned).toHaveLength(8);
    expect(cleaned!.map((e) => e.time)).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
  });

  it("hand-computed: smooths an 8-point same-camera track with SmoothWin=2 exactly", () => {
    const points: TrackEvent[] = [];
    for (let i = 0; i < 8; i++) points.push(ev(i * 10, 0, i * 1000, "camA", 1));

    const cleaned = cleanTrack(points);
    expect(cleaned).not.toBeNull();
    expect(cleaned!.map((e) => e.x)).toEqual([10, 15, 20, 30, 40, 50, 55, 60]);
    expect(cleaned!.every((e) => e.y === 0)).toBe(true);
    expect(cleaned!.map((e) => e.time)).toEqual([0, 1000, 2000, 3000, 4000, 5000, 6000, 7000]);
  });

  it("hand-computed: removes one large same-camera jump (> MaxJumpClean=6000mm) then smooths the rest", () => {
    const points: TrackEvent[] = [
      ev(0, 0, 0, "camA", 1),
      ev(10, 0, 1000, "camA", 1),
      ev(20, 0, 2000, "camA", 1),
      ev(30, 0, 3000, "camA", 1),
      ev(9999999, 0, 4000, "camA", 1), // jump of ~9999969mm from x=30 - removed
      ev(50, 0, 5000, "camA", 1),
      ev(60, 0, 6000, "camA", 1),
      ev(70, 0, 7000, "camA", 1),
      ev(80, 0, 8000, "camA", 1),
    ];

    const cleaned = cleanTrack(points);
    expect(cleaned).not.toBeNull();
    expect(cleaned).toHaveLength(8);
    expect(cleaned!.map((e) => e.time)).toEqual([0, 1000, 2000, 3000, 5000, 6000, 7000, 8000]);
    expect(cleaned!.map((e) => e.x)).toEqual([10, 15, 22, 34, 46, 58, 65, 70]);
  });

  it("does not filter a large jump across a camera boundary (removeLargeJumps only applies within the same camera)", () => {
    const points: TrackEvent[] = [
      ev(0, 0, 0, "camA", 1),
      ev(10, 0, 1000, "camA", 1),
      ev(20, 0, 2000, "camA", 1),
      ev(999999, 0, 3000, "camB", 9), // huge jump from the previous point, but a different camera - always kept
      ev(1000009, 0, 4000, "camB", 9), // small jumps from here on, relative to the new camB baseline
      ev(1000019, 0, 5000, "camB", 9),
      ev(1000029, 0, 6000, "camB", 9),
      ev(1000039, 0, 7000, "camB", 9),
    ];

    const cleaned = cleanTrack(points);
    expect(cleaned).not.toBeNull();
    expect(cleaned).toHaveLength(8); // nothing removed - the camera-boundary point always survives
  });
});

// ─────────────────────────────────────────────
// Exporter (FusionExporter.Export)
// ─────────────────────────────────────────────

describe("exportFusionResult", () => {
  function identity(gid: number, events: TrackEvent[], sources: { cam: string; sid: number }[]): FusedIdentity {
    return { gid, rep: [], tStart: events[0]?.time ?? 0, tEnd: events[events.length - 1]?.time ?? 0, x: 0, y: 0, tracks: [events], sources };
  }

  it("skips identities that clean to null and does not consume an index for them", () => {
    const tooShort = identity(0, [ev(0, 0, 0, "camA", 1), ev(1, 1, 100, "camA", 1)], [{ cam: "camA", sid: 1 }]);

    const eightPoints: TrackEvent[] = [];
    for (let i = 0; i < 8; i++) eightPoints.push(ev(i * 10, 0, i * 1000, "camB", 2));
    const kept = identity(1, eightPoints, [{ cam: "camB", sid: 2 }]);

    const output = exportFusionResult([tooShort, kept]);

    expect(Object.keys(output)).toEqual(["0"]);
    expect(output["0"].num_events).toBe(8);
    expect(output["0"].sources).toEqual([{ cam: "camB", sid: 2 }]);
    expect(output["0"].tracks[0]).toEqual({ x: 10, y: 0, t: 0, cam: "camB" });
    expect(output["0"].tracks.map((t) => t.x)).toEqual([10, 15, 20, 30, 40, 50, 55, 60]);
  });
});

// ─────────────────────────────────────────────
// Kalman2D (world transform smoothing)
// ─────────────────────────────────────────────

describe("Kalman2D", () => {
  it("hand-computed: first update() with dt=0 blends the measurement by P/(P+R) per axis", () => {
    const kf = new Kalman2D();
    const result = kf.update(100, 200, 0);
    // With dt=0, F=I so predict leaves x=[0,0,0,0], P=diag(100)+Q=diag(100.01). Then
    // S=P+R=diag(105.01), K=P/S=diag(100.01/105.01), x += K*y => x0=100*(100.01/105.01).
    const k = 100.01 / 105.01;
    expect(result.x).toBeCloseTo(100 * k, 6);
    expect(result.y).toBeCloseTo(200 * k, 6);
  });
});

// ─────────────────────────────────────────────
// LensUndistort
// ─────────────────────────────────────────────

describe("undistortPoint", () => {
  it("is an identity transform when all distortion coefficients are zero", () => {
    const K = [
      [1000, 0, 320],
      [0, 1000, 240],
      [0, 0, 1],
    ];
    const result = undistortPoint(500, 300, K, []);
    expect(result.x).toBeCloseTo(500, 9);
    expect(result.y).toBeCloseTo(300, 9);
  });
});

// ─────────────────────────────────────────────
// Dead-code parity: minimal YAML parser for FusionCameraIntrinsics.Load
// ─────────────────────────────────────────────

describe("parseIntrinsicsYaml", () => {
  it("parses a flow-style camera_matrix + distortion_coefficients block", () => {
    const yaml = `
camera_matrix:
  - [1000.0, 0.0, 640.0]
  - [0.0, 1000.0, 360.0]
  - [0.0, 0.0, 1.0]
distortion_coefficients:
  - [-0.1, 0.05, 0.0, 0.0, 0.0]
`;
    const result = parseIntrinsicsYaml(yaml);
    expect(result).not.toBeNull();
    expect(result!.cameraMatrix).toEqual([
      [1000, 0, 640],
      [0, 1000, 360],
      [0, 0, 1],
    ]);
    expect(result!.distCoeffs).toEqual([-0.1, 0.05, 0, 0, 0]);
  });

  it("returns null when camera_matrix is missing", () => {
    expect(parseIntrinsicsYaml("distortion_coefficients:\n  - [0,0,0,0,0]\n")).toBeNull();
  });
});
