import type { GalleryGeometry, LidarPoint3D, Mesh, MeshGenerationRequest, ScannerUploadRequest } from "../models/visualizer.js";
import { meshFaceCount, meshVertexCount } from "../models/visualizer.js";
import { extractPointCloudFromObj, parseObjFile, parsePlyStream, parseXyzFiles } from "./visualizerParserService.js";
import { calculateFullGeometry } from "./visualizerGeometryService.js";
import { createMeshFromPointCloud, createWatertightMesh, exportMeshToObj, optimizeMesh, smoothMeshLaplacian } from "./visualizerMeshService.js";

/**
 * Ported from BetterPlacemaking.SERVER/Controllers/VisualizerController.cs's private state
 * and the orchestration logic embedded in each of its actions - NOT from a single dedicated
 * C# service file (the original controller talks to PointCloudService/GeometryCalculationService/
 * ObjParserService/XyzParserService/PlyParserService/MeshGenerationService/FastMeshService/
 * GeometryExportService directly and holds its own `_currentPoints`/`_currentMesh` fields). This
 * module is the Express equivalent: the module-level `currentPoints`/`currentMesh`/
 * `sessionRevision` variables below ARE the session, and every exported function here is the
 * per-action orchestration a route handler in visualizer.routes.ts calls into.
 *
 * INHERITED ARCHITECTURAL LIMITATION (preserved, not a bug to fix here): the original
 * VisualizerController holds this state in `private static` fields - a single shared point
 * cloud/mesh session for the WHOLE server process, not scoped per-user/per-project/per-request.
 * That was fine for the old app's single-instance deployment model. This port reproduces the
 * exact same shape with module-level `let` variables (Node's module cache gives the same
 * "one instance for the whole process" semantics `static` gave C#). Two authenticated users
 * hitting this router concurrently share one point cloud, exactly as they did before. A real
 * fix (per-user or per-project sessions) is out of scope for this port.
 *
 * Threading note: the C# original guards every access with `lock (_lock)` because ASP.NET can
 * run concurrent requests on a thread pool. Node's single-threaded, run-to-completion event loop
 * means no two synchronous statements here can ever interleave, so no equivalent lock is needed -
 * this is a genuine platform difference, not a dropped safety mechanism.
 */

// ─── In-memory session state ────────────────────────────────────────────────

let currentPoints: LidarPoint3D[] = [];
let currentMesh: Mesh | null = null;
/** Mirrors VisualizerController's `_sessionRevision` - incremented whenever the session cloud is replaced or cleared. */
let sessionRevision = 0;

// ─── Error types (route handlers map these to the exact BadRequest bodies the C# actions returned) ───

/** Mirrors GenerateMesh's `return BadRequest("No points available to generate mesh")` early return. */
export class NoPointsAvailableError extends Error {
  constructor() {
    super("No points available to generate mesh");
    this.name = "NoPointsAvailableError";
  }
}

/** Mirrors GenerateMesh's `return BadRequest("Mesh generation produced no faces.")` early return. */
export class NoFacesGeneratedError extends Error {
  constructor() {
    super("Mesh generation produced no faces.");
    this.name = "NoFacesGeneratedError";
  }
}

/**
 * Mirrors the "No valid points found in ..." early-return BadRequests in UploadXyzFile/
 * UploadPlyFile (a plain-string body, NOT the `{ error }`-wrapped shape their surrounding
 * catch blocks produce for genuinely unexpected exceptions - callers must branch on this).
 */
export class NoValidPointsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoValidPointsError";
  }
}

// ─── Basic accessors ─────────────────────────────────────────────────────────

/** Mirrors VisualizerController.GetPoints. */
export function getPoints(): LidarPoint3D[] {
  return currentPoints;
}

/** Mirrors VisualizerController.GetPointsMeta / PointsMetaResponse. */
export function getPointsMeta(): { PointCount: number; Revision: number } {
  return { PointCount: currentPoints.length, Revision: sessionRevision };
}

/** Mirrors VisualizerController.GetRoomGeometry / ExportGeometryJson's shared geometry calc. */
export function getGeometry(): GalleryGeometry {
  return calculateFullGeometry(currentPoints);
}

/** Mirrors the mesh half of VisualizerController's session state, for direct inspection (e.g. tests). */
export function getCurrentMesh(): Mesh | null {
  return currentMesh;
}

/** Mirrors VisualizerController.ClearPoints. */
export function clearPoints(): void {
  currentPoints = [];
  currentMesh = null;
  sessionRevision++;
}

/**
 * Mirrors VisualizerController.SnapshotCurrentPointsForRplidar - used by rplidar.routes.ts's
 * `GET /from-scan` to read this session's point cloud without exposing the mutable live array.
 * Returns a defensive copy, matching the original's `new List<LidarPoint3D>(_currentPoints)`.
 */
export function snapshotPointsForRplidar(): LidarPoint3D[] {
  return [...currentPoints];
}

// ─── Shared "replace the session cloud, best-effort (re)generate a mesh" step ───

/**
 * Mirrors the identical `lock (_lock) { _currentPoints = points; _currentMesh = null; if
 * (points.Count >= 3) { try { ... CreateWatertightMesh ... } catch { console warning } }
 * _sessionRevision++; }` block repeated across UploadScannerData/UploadObjFile/UploadXyzFile/
 * UploadPlyFile (and ReplaceCurrentPointsFromIngest, the scan-ingest hook - see scanService.ts's
 * tryIngestFromScanDocument TODO stub for why that caller isn't wired up in this port). Returns
 * the newly (or not) generated mesh, same as each of those callers needs for its response body.
 */
export function replacePoints(points: LidarPoint3D[], meshFailureContext = ""): Mesh | null {
  currentPoints = points;
  currentMesh = null;

  if (points.length >= 3) {
    try {
      currentMesh = createWatertightMesh(points, 20000);
    } catch (err) {
      // Mirrors `Console.WriteLine($"Warning: Failed to generate mesh...: {meshEx.Message}")` -
      // a failed opportunistic mesh build must not fail the whole upload.
      console.warn(`Warning: Failed to generate mesh${meshFailureContext}: ${(err as Error).message}`);
    }
  }

  sessionRevision++;
  return currentMesh;
}

// ─── Upload orchestration (one function per upload endpoint) ───────────────

interface UploadSummary {
  pointCount: number;
  meshGenerated: boolean;
  meshVertexCount: number;
  meshFaceCount: number;
  message: string;
}

function summarize(points: LidarPoint3D[], mesh: Mesh | null, message: string): UploadSummary {
  return {
    pointCount: points.length,
    meshGenerated: mesh !== null,
    meshVertexCount: mesh ? meshVertexCount(mesh) : 0,
    meshFaceCount: mesh ? meshFaceCount(mesh) : 0,
    message,
  };
}

/** Uppercase, zero-padded (min 2 digits) hex - mirrors C#'s `{value:X2}` interpolation format (see visualizerParserService.ts's identical helper; duplicated here rather than imported since that module doesn't export it). */
function toHex2(value: number): string {
  const hex = Math.trunc(value).toString(16).toUpperCase();
  return hex.length < 2 ? hex.padStart(2, "0") : hex;
}

/**
 * Mirrors VisualizerController.UploadScannerData's point-conversion + session-replace logic.
 * Caller (visualizer.routes.ts) is responsible for the `request.Points` empty-check, which the
 * original does as a plain-string BadRequest before this logic ever runs.
 */
export function uploadScannerData(request: ScannerUploadRequest): UploadSummary {
  const convertFromMm = request.ConvertFromMillimeters ?? true;
  const scaleFactor = convertFromMm ? 0.1 : 1.0;

  const points: LidarPoint3D[] = request.Points.map((point) => {
    const x = point.X * scaleFactor;
    const y = point.Y * scaleFactor;
    const z = point.Z * scaleFactor;

    const r = point.R ?? 150;
    const g = point.G ?? 150;
    const b = point.B ?? 150;

    const intensity = (r + g + b) / 3.0 / 255.0;
    const color = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;

    return {
      X: x,
      Y: y,
      Z: z,
      Intensity: point.Intensity ?? intensity,
      Classification: 0,
      Color: color,
      Timestamp: new Date(),
      SensorId: request.SensorId ?? "rplidar",
    };
  });

  const mesh = replacePoints(points, " from scanner upload");
  return summarize(points, mesh, "Point cloud uploaded successfully.");
}

/** Mirrors VisualizerController.UploadObjFile's parse + session-replace logic (file I/O is the route's concern - see visualizer.routes.ts). */
export function loadFromObj(content: string): { vertexCount: number; faceCount: number; pointCloudCount: number } {
  const meshData = parseObjFile(content);
  const pointCloud = extractPointCloudFromObj(content);

  replacePoints(pointCloud, " from OBJ");

  return {
    vertexCount: meshData.Vertices.length,
    faceCount: meshData.Faces.length,
    pointCloudCount: pointCloud.length,
  };
}

/**
 * Mirrors VisualizerController.UploadXyzFile's parse + session-replace logic. Takes on-disk file
 * paths (like XyzParserService.ParseXyzFiles itself) - the route decodes the uploaded base64
 * payload to a temp file first, since parseXyzFiles's signature (unlike the OBJ/PLY parsers)
 * reads from disk, not from a content string - see visualizerParserService.ts's file header.
 */
export function loadFromXyzFiles(
  filePathA: string,
  filePathB: string | null | undefined,
  sensorId: string | null | undefined,
  units: string,
): UploadSummary {
  const points = parseXyzFiles(filePathA, filePathB, sensorId, units);

  if (points.length === 0) {
    throw new NoValidPointsError("No valid points found in .xyz files");
  }

  const mesh = replacePoints(points, " from .xyz upload");
  return summarize(points, mesh, "Point cloud loaded from .xyz files.");
}

/** Mirrors VisualizerController.UploadPlyFile's parse + session-replace logic. */
export function loadFromPly(content: string, maxPoints: number): UploadSummary {
  const points = parsePlyStream(content, undefined, maxPoints);

  if (points.length === 0) {
    throw new NoValidPointsError("No valid points found in PLY file");
  }

  const mesh = replacePoints(points, " from PLY");
  return summarize(points, mesh, "Point cloud loaded from PLY file.");
}

// ─── Mesh (re)generation ─────────────────────────────────────────────────────

/**
 * Mirrors VisualizerController.GenerateMesh. Returns the mesh's OBJ text (the route sends it as
 * `text/plain`, matching `Content(objContent, "text/plain")`). Throws NoPointsAvailableError /
 * NoFacesGeneratedError for the two named early-return BadRequests; any other error (e.g. a
 * genuine failure inside the mesh-generation services) propagates as a plain Error, which the
 * route formats as `Error generating mesh: {message}` - mirroring the C# action's single
 * `catch (Exception ex) { return BadRequest($"Error generating mesh: {ex.Message}"); }` wrapping
 * everything else.
 */
export function generateMesh(request: MeshGenerationRequest | undefined): string {
  const targetMeshPoints = request?.TargetMeshPoints ?? 20000;
  const alphaValue = request?.AlphaValue ?? 30.0;
  const smoothingIterations = request?.SmoothingIterations ?? 5;
  const useLegacy = request?.UseLegacy ?? false;
  const forceRegenerate = request?.ForceRegenerate ?? false;

  if (currentMesh && !useLegacy && !forceRegenerate) {
    return exportMeshToObj(currentMesh);
  }

  if (currentPoints.length === 0) {
    throw new NoPointsAvailableError();
  }

  let mesh: Mesh;
  if (useLegacy) {
    mesh = createMeshFromPointCloud(currentPoints);
    mesh = smoothMeshLaplacian(mesh, smoothingIterations);
    mesh = optimizeMesh(mesh);
  } else {
    // NOTE on the known Delaunay3DNotSupportedError gap: createWatertightMesh already catches
    // that internally and falls back to the 2.5D triangulation path (see visualizerMeshService.ts) -
    // it never lets that error escape here. visualizer.routes.ts still defensively checks for it
    // on this call so a future change that removes that internal fallback fails loudly (a clear
    // error response) instead of as an unhandled 500.
    mesh = createWatertightMesh(currentPoints, targetMeshPoints, alphaValue, smoothingIterations);
  }

  if (meshFaceCount(mesh) === 0) {
    throw new NoFacesGeneratedError();
  }

  currentMesh = mesh;
  return exportMeshToObj(mesh);
}
