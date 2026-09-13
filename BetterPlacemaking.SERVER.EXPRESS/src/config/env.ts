import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  port: optionalInt("PORT", 5200),
  nodeEnv: optional("NODE_ENV", "development") as string,
  isProduction: process.env.NODE_ENV === "production",

  firebaseProjectId: required("FIREBASE_PROJECT_ID"),
  firebaseDatabaseId: optional("FIREBASE_DATABASE_ID", "(default)") as string,

  jwtKey: required("JWT_KEY"),
  jwtIssuer: required("JWT_ISSUER"),
  jwtAudience: required("JWT_AUDIENCE"),
  jwtExpiresMinutes: optionalInt("JWT_EXPIRES_MINUTES", 60),

  authRefreshTokenHashKey: optional("AUTH_REFRESH_TOKEN_HASH_KEY"),
  authRefreshTokenDays: optionalInt("AUTH_REFRESH_TOKEN_DAYS", 30),
  authAccessTokenMinutes: process.env.AUTH_ACCESS_TOKEN_MINUTES
    ? Number.parseInt(process.env.AUTH_ACCESS_TOKEN_MINUTES, 10)
    : undefined,

  allowedOrigins: (optional("ALLOWED_ORIGINS", "") as string)
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0),

  apiBaseUrl: optional("API_BASE_URL", "http://localhost:5200") as string,
  appBaseUrl: optional("APP_BASE_URL", "http://localhost:5173") as string,

  mailjetKey: optional("MAILJET_KEY"),
  mailjetSecretKey: optional("MAILJET_SECRET_KEY"),
  mailjetFromEmail: optional("MAILJET_FROM_EMAIL", "lanzzhen@gmail.com") as string,
  mailjetFromName: optional("MAILJET_FROM_NAME", "BetterPlacemaking") as string,

  redisUrl: optional("REDIS_URL"),

  // --- Tracking (mirrors appsettings.json "Tracking" section) ---
  // Tracking data is a filesystem artifact of the offline CV pipeline (CSV of recent
  // detections + one JSON file per finished track), not a Firestore collection - see
  // trackingService.ts for the read/parse logic ported from TrackingDataService.cs.
  trackingPositionsCsv: optional("TRACKING_POSITIONS_CSV", "Data/positions.csv") as string,
  trackingTracksDir: optional("TRACKING_TRACKS_DIR", "Data/tracks") as string,
  trackingOffsetX: optionalFloat("TRACKING_OFFSET_X", 0),
  trackingOffsetY: optionalFloat("TRACKING_OFFSET_Y", 0),
  trackingOffsetZ: optionalFloat("TRACKING_OFFSET_Z", 0),
  trackingRotationAngle: optionalFloat("TRACKING_ROTATION_ANGLE", 0),
  trackingScaleX: optionalFloat("TRACKING_SCALE_X", 1),
  trackingScaleZ: optionalFloat("TRACKING_SCALE_Z", 1),

  // --- GCS (signed URLs for media upload/download), mirrors appsettings.json "Gcs" section ---
  gcsBucketName: required("GCS_BUCKET_NAME"),
  gcsUrlTtlMinutes: optionalInt("GCS_URL_TTL_MINUTES", 10080),
};

export function refreshTokenHashKey(): string {
  const key = env.authRefreshTokenHashKey ?? env.jwtKey;
  if (!key) {
    throw new Error("Neither AUTH_REFRESH_TOKEN_HASH_KEY nor JWT_KEY is configured.");
  }
  return key;
}

export function accessTokenMinutes(): number {
  return env.authAccessTokenMinutes ?? env.jwtExpiresMinutes;
}
