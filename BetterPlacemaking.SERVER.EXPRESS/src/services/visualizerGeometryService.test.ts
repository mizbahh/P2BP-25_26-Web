import { describe, expect, it } from "vitest";
import type { GalleryGeometry, LidarPoint3D } from "../models/visualizer.js";
import {
  calculateFullGeometry,
  exportGeometryToJson,
  exportPointCloudToObj,
  exportRoomGeometryToObj,
  exportToCsv,
  exportToPly,
  exportToPts,
  exportToTxt,
  exportToXyz,
  exportToXyzRgb,
} from "./visualizerGeometryService.js";

const points: LidarPoint3D[] = [
  { X: 100, Y: 200, Z: 50, Intensity: 0.5, Classification: 1, Color: "#FF8000" },
  { X: -50, Y: 0, Z: 25, Intensity: 1, Classification: 0, Color: null },
];

describe("calculateFullGeometry", () => {
  it("returns a zeroed Empty Room for no points", () => {
    expect(calculateFullGeometry([])).toEqual({
      Name: "Empty Room",
      Width: 0,
      Height: 0,
      Depth: 0,
      Walls: [],
      Objects: [],
    });
  });

  it("computes Width=X extent, Height=Z extent, Depth=Y extent", () => {
    const geometry = calculateFullGeometry(points);
    expect(geometry).toEqual({
      Name: "Calculated Room",
      Width: 150, // maxX(100) - minX(-50)
      Height: 25, // maxZ(50) - minZ(25)
      Depth: 200, // maxY(200) - minY(0)
      Walls: [],
      Objects: [],
    });
  });
});

describe("exportRoomGeometryToObj", () => {
  it("emits a two-line comment-only header", () => {
    const geometry: GalleryGeometry = { Name: "Room", Width: 10, Height: 5, Depth: 8, Walls: [], Objects: [] };
    expect(exportRoomGeometryToObj(geometry)).toBe("# Room Geometry OBJ Export\n# Width: 10, Height: 5, Depth: 8\n");
  });
});

describe("exportPointCloudToObj", () => {
  it("emits 'v X Z Y' per point (Y/Z swapped), native units", () => {
    expect(exportPointCloudToObj(points)).toBe("# Point Cloud OBJ Export\nv 100 50 200\nv -50 25 0\n");
  });
});

describe("exportToCsv", () => {
  it("emits the exact header and rows, with an empty Color cell when null", () => {
    expect(exportToCsv(points)).toBe(
      "X,Y,Z,Intensity,Classification,Color\n100,200,50,0.5,1,#FF8000\n-50,0,25,1,0,\n",
    );
  });
});

describe("exportToXyz", () => {
  it("converts cm to meters, fixed 6 decimals, no header", () => {
    expect(exportToXyz(points)).toBe("1.000000 2.000000 0.500000\n-0.500000 0.000000 0.250000\n");
  });
});

describe("exportToXyzRgb", () => {
  it("appends parsed r g b, defaulting to mid-gray for a missing Color", () => {
    expect(exportToXyzRgb(points)).toBe(
      "1.000000 2.000000 0.500000 255 128 0\n-0.500000 0.000000 0.250000 128 128 128\n",
    );
  });
});

describe("exportToTxt", () => {
  it("comma-separated meters, fixed 6 decimals", () => {
    expect(exportToTxt(points)).toBe("1.000000,2.000000,0.500000\n-0.500000,0.000000,0.250000\n");
  });
});

describe("exportToPts", () => {
  it("emits a point-count header then 'x y z intensity r g b', intensity truncated toward zero", () => {
    expect(exportToPts(points)).toBe(
      "2\n1.000000 2.000000 0.500000 127 255 128 0\n-0.500000 0.000000 0.250000 255 128 128 128\n",
    );
  });
});

describe("exportToPly", () => {
  it("emits the fixed ASCII PLY header then 'x y z r g b' per point", () => {
    expect(exportToPly(points)).toBe(
      [
        "ply",
        "format ascii 1.0",
        "element vertex 2",
        "property float x",
        "property float y",
        "property float z",
        "property uchar red",
        "property uchar green",
        "property uchar blue",
        "end_header",
        "1.000000 2.000000 0.500000 255 128 0",
        "-0.500000 0.000000 0.250000 128 128 128",
        "",
      ].join("\n"),
    );
  });
});

describe("exportGeometryToJson", () => {
  it("round-trips the geometry as indented, PascalCase JSON", () => {
    const geometry: GalleryGeometry = { Name: "Room", Width: 10, Height: 5, Depth: 8, Walls: [], Objects: [] };
    const json = exportGeometryToJson(geometry);
    expect(JSON.parse(json)).toEqual(geometry);
    expect(json).toContain('"Name": "Room"');
    expect(json.startsWith("{\n  ")).toBe(true); // 2-space indent
  });
});
