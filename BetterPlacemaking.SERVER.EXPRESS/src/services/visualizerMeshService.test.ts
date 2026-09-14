import { describe, expect, it } from "vitest";
import type { LidarPoint3D, Mesh } from "../models/visualizer.js";
import {
  Delaunay3DNotSupportedError,
  createMeshFromPointCloud,
  createWatertightMesh,
  delaunayTriangulate3D,
  downsampleForMesh,
  exportMeshToObj,
  optimizeMesh,
  smoothMeshLaplacian,
  triangulate2_5D,
} from "./visualizerMeshService.js";

/** Builds a minimal LidarPoint3D - Intensity/Classification are required fields but irrelevant to mesh geometry. */
function lp(x: number, y: number, z: number, color: string | null = null): LidarPoint3D {
  return { X: x, Y: y, Z: z, Intensity: 0, Classification: 0, Color: color };
}

describe("createMeshFromPointCloud", () => {
  it("returns an empty mesh for no input", () => {
    const mesh = createMeshFromPointCloud([]);
    expect(mesh).toEqual({ Vertices: [], Normals: [], Faces: [], Colors: [] });
  });

  it("returns vertices only (no faces/normals) when fewer than 3 points survive preprocessing", () => {
    // Two points closer together than the 0.1-unit preprocessing tolerance collapse to one.
    const mesh = createMeshFromPointCloud([lp(0, 0, 0), lp(0.01, 0, 0)]);
    expect(mesh.Vertices).toHaveLength(1);
    expect(mesh.Faces).toEqual([]);
    expect(mesh.Normals).toEqual([]);
  });

  it(
    "estimates a normal via the SpatialGrid fallback's duplicate-neighbor path " +
      "(preserved verbatim from the C# source) for exactly 3 points",
    () => {
      // A 3-4-5 right triangle flat on Z=0, chosen so all 3 pairwise distances are distinct
      // (no ties) - this deterministically exercises SpatialGrid.findKNearestNeighbors's
      // fallback path: with only 3 points and k=15, each point's "other 2" points land in
      // separate grid cells the shell-search finds one at a time, and are then appended AGAIN
      // in full by the k-not-met fallback (which does not clear the list first - a
      // verbatim-preserved quirk of the original, see the class comment on SpatialGrid).
      // After the stable sort-by-distance, the two entries for whichever other point is
      // strictly closer land in slots [0] and [1] - so estimateNormals's p0 and p1 end up
      // being the SAME point (zero cross product), and it falls back to the default normal
      // (0, 0, 1) for every point in the cloud.
      const points = [lp(0, 0, 0), lp(4, 0, 0), lp(0, 3, 0)];
      const mesh = createMeshFromPointCloud(points);

      expect(mesh.Vertices).toEqual([
        { X: 0, Y: 0, Z: 0 },
        { X: 4, Y: 0, Z: 0 },
        { X: 0, Y: 3, Z: 0 },
      ]);

      expect(mesh.Normals).toEqual([
        { X: 0, Y: 0, Z: 1 },
        { X: 0, Y: 0, Z: 1 },
        { X: 0, Y: 0, Z: 1 },
      ]);

      expect(mesh.Colors).toEqual([]);
    },
  );

  it(
    "produces a correctly-wound triangulation (fixed vs. the C# source - see " +
      "triangulateDelaunay2_5D's doc comment in visualizerMeshService.ts for the bug and fix)",
    () => {
      // The C# source builds each new triangle from the *sorted-ascending* edge-dedup key
      // instead of the edge's original CCW-consistent direction, which corrupts every
      // subsequent circumcircle test and makes it produce ZERO faces for any realistic input
      // (verified by hand and empirically against an unfixed port, across a 3-point triangle,
      // a 4-point quad, and a 3x3 grid - every case produced zero faces). Fixed here by
      // reconstructing triangles from each boundary edge's original direction; the sorted key
      // is used only to detect "appears exactly once" (the standard boundary-edge test).
      const triangle = createMeshFromPointCloud([lp(0, 0, 0), lp(4, 0, 0), lp(0, 3, 0)]);
      expect(triangle.Faces).toEqual([[0, 1, 2]]);

      // A convex quad triangulates into exactly 2 triangles.
      const quad = createMeshFromPointCloud([lp(0, 0, 0), lp(5, 0, 0), lp(6, 4, 0), lp(-1, 3, 0)]);
      expect(quad.Faces).toHaveLength(2);

      // An n x n regular grid triangulates into exactly (n-1)*(n-1)*2 triangles - the
      // textbook-correct count for a fully-triangulated grid, confirming general correctness
      // beyond the two hand-picked small cases above.
      const grid: LidarPoint3D[] = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) grid.push(lp(i, j, 0));
      expect(createMeshFromPointCloud(grid).Faces).toHaveLength(8);
    },
  );
});

describe("smoothMeshLaplacian", () => {
  // A "bump": 4 flat corners of a unit square (boundary) plus an elevated center vertex
  // (interior), fanned into 4 triangles. Every perimeter edge (0-1, 1-2, 2-3, 3-0) is used
  // by exactly one face -> boundary. Every center-to-corner edge is shared by exactly two
  // faces -> interior. So vertex 4 is the mesh's only interior (smoothable) vertex, and its
  // 4 neighbors are exactly the 4 corners.
  const corners: Mesh["Vertices"] = [
    { X: 0, Y: 0, Z: 0 },
    { X: 1, Y: 0, Z: 0 },
    { X: 1, Y: 1, Z: 0 },
    { X: 0, Y: 1, Z: 0 },
  ];
  const bumpMesh: Mesh = {
    Vertices: [...corners, { X: 0.5, Y: 0.5, Z: 5 }],
    Normals: [],
    Faces: [
      [0, 1, 4],
      [1, 2, 4],
      [2, 3, 4],
      [3, 0, 4],
    ],
    Colors: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 0],
      [0, 1, 1],
    ],
  };

  it("moves the interior vertex exactly halfway to its neighbor average after 1 iteration (default lambda=0.5), leaving boundary vertices untouched", () => {
    const smoothed = smoothMeshLaplacian(bumpMesh, 1);

    // Corner average X/Y is already 0.5/0.5 (matches the bump's X/Y), so only Z moves:
    // current.Z=5, avg neighbor Z=0 -> new Z = 5 + 0.5*(0-5) = 2.5.
    expect(smoothed.Vertices[4]).toEqual({ X: 0.5, Y: 0.5, Z: 2.5 });

    // Boundary vertices are never moved by design.
    expect(smoothed.Vertices.slice(0, 4)).toEqual(corners);
  });

  it("converges the interior vertex toward the exact neighbor average over many iterations", () => {
    const smoothed = smoothMeshLaplacian(bumpMesh, 50);
    expect(smoothed.Vertices[4].Z).toBeCloseTo(0, 9);
    expect(smoothed.Vertices[4].X).toBeCloseTo(0.5, 9);
    expect(smoothed.Vertices[4].Y).toBeCloseTo(0.5, 9);
  });

  it("does NOT preserve Colors on the returned mesh (verbatim port of the original's omission)", () => {
    const smoothed = smoothMeshLaplacian(bumpMesh, 1);
    expect(smoothed.Colors).toEqual([]);
  });

  it("is a no-op (returns the same mesh reference) when there are no faces", () => {
    const noFaces: Mesh = { Vertices: corners, Normals: [], Faces: [], Colors: [] };
    expect(smoothMeshLaplacian(noFaces)).toBe(noFaces);
  });
});

describe("optimizeMesh", () => {
  it("merges near-duplicate vertices within the distance threshold and drops the resulting degenerate face", () => {
    // v3 is a near-duplicate of v0 (well within the merge threshold derived from the mesh's
    // average edge length), so it should be merged into v0's slot; the second face
    // ([0,1,3]) then becomes degenerate ([0,1,0]) and must be dropped entirely.
    const v0 = { X: 0, Y: 0, Z: 0 };
    const v1 = { X: 10, Y: 0, Z: 0 };
    const v2 = { X: 0, Y: 10, Z: 0 };
    const v3 = { X: 0, Y: 0, Z: 0.0001 };

    const mesh: Mesh = {
      Vertices: [v0, v1, v2, v3],
      Normals: [],
      Faces: [
        [0, 1, 2],
        [0, 1, 3],
      ],
      Colors: [],
    };

    const optimized = optimizeMesh(mesh);

    expect(optimized.Vertices).toHaveLength(3);
    expect(optimized.Vertices).toEqual([v0, v1, v2]);
    expect(optimized.Faces).toEqual([[0, 1, 2]]);
  });

  it("does NOT preserve Colors on the returned mesh (verbatim port of the original's omission)", () => {
    const mesh: Mesh = {
      Vertices: [
        { X: 0, Y: 0, Z: 0 },
        { X: 10, Y: 0, Z: 0 },
        { X: 0, Y: 10, Z: 0 },
      ],
      Normals: [],
      Faces: [[0, 1, 2]],
      Colors: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    };
    expect(optimizeMesh(mesh).Colors).toEqual([]);
  });
});

describe("exportMeshToObj", () => {
  it("emits v/f lines with the X/Z/Y axis swap and 1-based face indices, no vn without normals", () => {
    const mesh: Mesh = {
      Vertices: [
        { X: 0, Y: 1, Z: 2 },
        { X: 3, Y: 4, Z: 5 },
        { X: 6, Y: 7, Z: 8 },
      ],
      Normals: [],
      Faces: [[0, 1, 2]],
      Colors: [],
    };
    expect(exportMeshToObj(mesh)).toBe("v 0 2 1\nv 3 5 4\nv 6 8 7\nf 1 2 3\n");
  });

  it("emits vn lines and //-suffixed face indices when normals are present", () => {
    const mesh: Mesh = {
      Vertices: [
        { X: 0, Y: 0, Z: 0 },
        { X: 1, Y: 0, Z: 0 },
        { X: 0, Y: 1, Z: 0 },
      ],
      Normals: [
        { X: 0, Y: 0, Z: 1 },
        { X: 0, Y: 0, Z: 1 },
        { X: 0, Y: 0, Z: 1 },
      ],
      Faces: [[0, 1, 2]],
      Colors: [],
    };
    expect(exportMeshToObj(mesh)).toBe("v 0 0 0\nv 1 0 0\nv 0 0 1\nvn 0 1 0\nvn 0 1 0\nvn 0 1 0\nf 1//1 2//2 3//3\n");
  });

  it("returns an empty string for an empty mesh", () => {
    expect(exportMeshToObj({ Vertices: [], Normals: [], Faces: [], Colors: [] })).toBe("");
  });
});

describe("downsampleForMesh", () => {
  it("returns the input unchanged when already at or under the target count", () => {
    const points = [lp(0, 0, 0), lp(1, 1, 1)];
    expect(downsampleForMesh(points, 5)).toEqual(points);
  });

  it("voxel-averages a cluster of points down to a single representative point", () => {
    // All points fall within a tiny bounding box, so with a target of 1 the single voxel
    // covers everything and the result is their centroid, carrying the first point's
    // non-positional fields.
    const points = [lp(0, 0, 0, "#ff0000"), lp(0.2, 0, 0), lp(0, 0.2, 0), lp(0.2, 0.2, 0)];
    const result = downsampleForMesh(points, 1);

    expect(result).toHaveLength(1);
    expect(result[0].X).toBeCloseTo(0.1, 9);
    expect(result[0].Y).toBeCloseTo(0.1, 9);
    expect(result[0].Z).toBeCloseTo(0, 9);
    expect(result[0].Color).toBe("#ff0000");
  });
});

describe("delaunayTriangulate3D (3D tetrahedral Delaunay - not implemented)", () => {
  it("throws Delaunay3DNotSupportedError for >=4 points, matching FastMeshService's entry guard threshold", () => {
    const points = [lp(0, 0, 0), lp(1, 0, 0), lp(0, 1, 0), lp(0, 0, 1)];
    expect(() => delaunayTriangulate3D(points)).toThrow(Delaunay3DNotSupportedError);
  });

  it("returns an empty mesh (does not throw) for fewer than 4 points, matching the original guard", () => {
    const mesh = delaunayTriangulate3D([lp(0, 0, 0), lp(1, 0, 0)]);
    expect(mesh).toEqual({ Vertices: [], Normals: [], Faces: [], Colors: [] });
  });
});

describe("triangulate2_5D (delaunator-backed 2D Delaunay)", () => {
  it("triangulates a well-spread point set and parses per-point hex colors", () => {
    const points = [lp(0, 0, 0, "#ff0000"), lp(10, 0, 0, "#00ff00"), lp(10, 10, 0, "#0000ff"), lp(0, 10, 0)];
    const mesh = triangulate2_5D(points);

    expect(mesh.Vertices).toHaveLength(4);
    expect(mesh.Faces.length).toBeGreaterThan(0);
    for (const face of mesh.Faces) expect(face).toHaveLength(3);

    expect(mesh.Colors[0]).toEqual([1, 0, 0]);
    expect(mesh.Colors[1]).toEqual([0, 1, 0]);
    expect(mesh.Colors[2]).toEqual([0, 0, 1]);
    expect(mesh.Colors[3]).toEqual([0.5, 0.5, 0.5]); // no Color -> default mid-gray
  });

  it("returns vertices/colors but no faces for fewer than 3 points", () => {
    const mesh = triangulate2_5D([lp(0, 0, 0), lp(1, 1, 1)]);
    expect(mesh.Vertices).toHaveLength(2);
    expect(mesh.Faces).toEqual([]);
  });
});

describe("createWatertightMesh (orchestrator - always takes the 2.5D fallback path)", () => {
  it("returns an empty mesh for fewer than 4 input points", () => {
    expect(createWatertightMesh([lp(0, 0, 0), lp(1, 0, 0)])).toEqual({
      Vertices: [],
      Normals: [],
      Faces: [],
      Colors: [],
    });
  });

  it("falls back to the 2.5D triangulation path and produces a normalized, colored mesh", () => {
    const points = [lp(0, 0, 0), lp(10, 0, 0), lp(10, 10, 0), lp(0, 10, 0), lp(5, 5, 1)];
    // Large targetMeshPoints (no downsampling), huge alpha (no edge-length filtering),
    // zero smoothing iterations to keep the expected output simple/deterministic.
    const mesh = createWatertightMesh(points, 1000, 1000, 0);

    expect(mesh.Faces.length).toBeGreaterThan(0);
    // closeHoles may add a centroid vertex per boundary loop (an open 2.5D triangulation's
    // outer hull is itself one big "hole"), so vertex count can exceed the input count -
    // but Normals/Colors must always be sized to match the final vertex count exactly.
    expect(mesh.Vertices.length).toBeGreaterThanOrEqual(points.length);
    expect(mesh.Normals).toHaveLength(mesh.Vertices.length);
    expect(mesh.Colors).toHaveLength(mesh.Vertices.length);

    // Every computed normal must be unit length (or the (0,1,0) degenerate default).
    for (const n of mesh.Normals) {
      const len = Math.sqrt(n.X * n.X + n.Y * n.Y + n.Z * n.Z);
      expect(len).toBeCloseTo(1, 9);
    }
  });
});
