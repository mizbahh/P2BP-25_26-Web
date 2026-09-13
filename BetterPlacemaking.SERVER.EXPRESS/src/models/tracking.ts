/**
 * Ported from BetterPlacemaking.SERVER/Models/Tracking/TrackingModels.cs, itself
 * ported from P2BP-25_26-Visualizer GalleryModelApi/Models/TrackingData.cs.
 *
 * The ASP.NET server sets `opts.JsonSerializerOptions.PropertyNamingPolicy = null`
 * (Program.cs), so these PascalCase field names ARE the wire format for
 * GET /api/tracking/positions, /tracks, and /tracks/:globalId - do not camelCase them.
 */

/** One row of the offline tracker's positions CSV. */
export interface TrackingPosition {
  GlobalId: number;
  CameraId: string;
  FrameIdx: number;
  /** ISO-8601 string - mirrors .NET's default JSON encoding of DateTime. */
  Timestamp: string;
  XGround?: number | null;
  YGround?: number | null;
  X1: number;
  Y1: number;
  X2: number;
  Y2: number;
  Confidence: number;
}

/** A single point on a finished track, already transformed into lidar space. */
export interface TrackingPoint3D {
  X: number;
  Y: number;
  Z: number;
}

export interface PathPoint {
  Position: TrackingPoint3D;
  Timestamp: string;
}

/** One `*.json` track file under Tracking:TracksDir. */
export interface TrackingPath {
  GlobalId: number;
  CameraId: string;
  Id: string;
  IndividualId: string;
  Points: PathPoint[];
  StartTime: string;
  EndTime: string;
  FirstSeenFrame: number;
  LastSeenFrame: number;
  NumDetections: number;
}

/**
 * Response shape for GET /api/tracking/active.
 *
 * Unlike its siblings, TrackingDataService.GetActiveTracks builds a C# anonymous
 * object with explicitly lowercase member names (globalId, latestPosition, xGround,
 * yGround, timestamp). With PropertyNamingPolicy = null those literal names are the
 * wire format, so this one endpoint is genuinely camelCase while /positions, /tracks,
 * and /tracks/:globalId are PascalCase. Ported verbatim, asymmetry and all.
 */
export interface ActiveTrackSummary {
  globalId: number;
  latestPosition: {
    xGround: number;
    yGround: number;
    timestamp: string;
  };
}
