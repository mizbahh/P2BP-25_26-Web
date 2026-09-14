/**
 * Ported from BetterPlacemaking.SERVER/Models/Visualizer/*.cs - shared types for the
 * Visualizer subsystem (point-cloud/mesh parsing, geometry calculation/export, and
 * mesh generation). Field names/casing mirror the C# models exactly (PascalCase),
 * matching this codebase's convention of porting DTOs verbatim rather than
 * translating to camelCase (see models/device.ts, models/scanDevice.ts).
 *
 * This is the SHARED type file for the whole Visualizer subsystem - the parser
 * service (services/visualizerParserService.ts), the geometry calculation/export
 * service (services/visualizerGeometryService.ts), the (separately ported) mesh
 * generation service, and a later Visualizer routes/controller port all import
 * from here rather than redefining these shapes.
 */

// ─── Models/Visualizer/Point3D.cs ───

/** A bare 3D point/vector. Used for mesh vertices/normals and gallery positions/rotations/scale. */
export interface Point3D {
  X: number;
  Y: number;
  Z: number;
}

// ─── Models/Visualizer/LidarPoint.cs ───

/** A bare 2D point (no Z) - input shape for PointCloudService.Convert2DTo3D. */
export interface LidarPoint {
  X: number;
  Y: number;
}

// ─── Models/Visualizer/LidarPoint3D.cs ───

/**
 * A single classified/colored LiDAR point. X/Y/Z are centimeters throughout this
 * subsystem (parsers convert from their source file's native units - meters for
 * PLY, mm/m for XYZ - into centimeters on the way in; exporters convert back to
 * meters on the way out for Rhino-facing formats).
 */
export interface LidarPoint3D {
  /** X coordinate (cm) */
  X: number;
  /** Y coordinate (depth, cm) */
  Y: number;
  /** Z coordinate (height, cm) */
  Z: number;
  /** Intensity value (0-1) */
  Intensity: number;
  /** Point classification */
  Classification: number;
  /** Hex color (#RRGGBB) */
  Color?: string | null;
  /** Optional timestamp */
  Timestamp?: Date | null;
  /** Optional sensor ID */
  SensorId?: string | null;
}

// ─── Models/Visualizer/Mesh.cs ───

/**
 * A generated/parsed mesh. `Colors` mirrors the C# `List<(double R, double G,
 * double B)>` per-vertex color tuple list as an `[R, G, B]` 3-tuple array.
 *
 * The C# type also exposes VertexCount/FaceCount/HasNormals/HasColors as
 * computed (getter-only) properties; since this is a plain data interface (not a
 * class) here, those are ported as the standalone functions below instead of
 * methods on the object.
 */
export interface Mesh {
  Vertices: Point3D[];
  Normals: Point3D[];
  Faces: number[][];
  Colors: [number, number, number][];
}

/** Mirrors Mesh.VertexCount. */
export function meshVertexCount(mesh: Mesh): number {
  return mesh.Vertices.length;
}

/** Mirrors Mesh.FaceCount. */
export function meshFaceCount(mesh: Mesh): number {
  return mesh.Faces.length;
}

/** Mirrors Mesh.HasNormals. */
export function meshHasNormals(mesh: Mesh): boolean {
  return mesh.Normals.length > 0 && mesh.Normals.length === mesh.Vertices.length;
}

/** Mirrors Mesh.HasColors. */
export function meshHasColors(mesh: Mesh): boolean {
  return mesh.Colors.length > 0 && mesh.Colors.length === mesh.Vertices.length;
}

// ─── Models/Visualizer/GalleryGeometry.cs ───

export interface GalleryGeometry {
  Name: string;
  Width: number;
  Height: number;
  Depth: number;
  Walls: Wall[];
  Objects: GalleryObject[];
}

export interface Wall {
  Id: string;
  Label: string;
  Position: Point3D;
  Width: number;
  Height: number;
  Thickness: number;
  IsMovable: boolean;
}

export interface GalleryObject {
  Id: string;
  Label: string;
  Type: string;
  Position: Point3D;
  Rotation: Point3D;
  Scale: Point3D;
  Width: number;
  Height: number;
  Depth: number;
}

// ─── Models/Visualizer/VisualizerDTOs.cs ───

/**
 * Mesh (re)generation request options. Optional here (mirroring that these are
 * caller-supplied JSON body fields); C# defaults are noted per-field - a later
 * consumer (the mesh generation service/controller) is responsible for applying
 * them when a field is omitted, same as C#'s property initializers do implicitly
 * on model bind.
 */
export interface MeshGenerationRequest {
  /** Default: 20000 */
  TargetMeshPoints?: number;
  /** Default: 30.0 */
  AlphaValue?: number;
  /** Default: 5 */
  SmoothingIterations?: number;
  /** Default: false */
  UseLegacy?: boolean;
  /** Default: false */
  ForceRegenerate?: boolean;
}

/** A single raw point as uploaded by a scanner client. */
export interface ScannerPoint {
  X: number;
  Y: number;
  Z: number;
  Intensity?: number | null;
  R?: number | null;
  G?: number | null;
  B?: number | null;
}

export interface ScannerUploadRequest {
  Points: ScannerPoint[];
  SensorId?: string | null;
  ConvertFromMillimeters?: boolean | null;
}
