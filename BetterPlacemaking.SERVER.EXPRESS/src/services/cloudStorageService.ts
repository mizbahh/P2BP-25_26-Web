import { getBucket } from "../config/storage.js";
import { env } from "../config/env.js";

/** Ported from CloudStorageService's input-validation exceptions. */
export class ValidationError extends Error {}

export interface RequestUploadUrlInput {
  PathFromRoot?: string;
  FileName?: string;
  Extension?: string;
  SizeBytes?: number;
}

export interface RequestDownloadUrlInput {
  PathFromRoot?: string;
}

export interface SignedUrlResult {
  PathFromRoot: string;
  SignedUrl: string;
  ExpiresAt: Date;
}

/**
 * Collapses repeated slashes and strips characters GCS object names shouldn't
 * carry, ported char-for-char from CloudStorageService.SanitizeObjectPath:
 * letters, digits, '-' '_' ':' '.' ' ' survive as-is, everything else becomes '_'.
 */
function sanitizeObjectPath(path: string | undefined | null): string {
  if (!path || !path.trim()) throw new ValidationError("PathFromRoot required.");

  const normalizedSlashes = path.replace(/\\/g, "/").trim().replace(/^\/+|\/+$/g, "");
  if (normalizedSlashes.length === 0) throw new ValidationError("PathFromRoot required.");

  let result = "";
  let lastWasSlash = false;
  for (const c of normalizedSlashes) {
    if (c === "/") {
      if (!lastWasSlash) {
        result += "/";
        lastWasSlash = true;
      }
      continue;
    }
    lastWasSlash = false;
    if (/[a-zA-Z0-9\-_: .]/.test(c)) {
      result += c;
    } else {
      result += "_";
    }
  }

  const cleaned = result.replace(/^\/+|\/+$/g, "");
  if (!cleaned.trim()) throw new ValidationError("PathFromRoot required.");
  return cleaned;
}

/** Ported from CloudStorageService.NormalizeObjectPath. */
export function normalizeObjectPath(rawPath: string | undefined | null): string {
  return sanitizeObjectPath(rawPath);
}

/** Ported from CloudStorageService.SanitizeFileName. */
function sanitizeFileName(fileName: string | undefined | null): string {
  if (!fileName || !fileName.trim()) throw new ValidationError("FileName required.");

  let name = fileName.replace(/\\/g, "/");
  const segments = name.split("/");
  name = segments[segments.length - 1] || "file";
  // Path.GetFileNameWithoutExtension: strip everything from the last '.' onward.
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex > 0) name = name.slice(0, dotIndex);
  name = name.trim();

  let result = "";
  for (const c of name) {
    result += /[a-zA-Z0-9\-_ ]/.test(c) ? c : "_";
  }

  const cleaned = result;
  if (!cleaned.trim()) throw new ValidationError("FileName required.");
  return cleaned;
}

/** Ported from CloudStorageService.NormalizeExtension. */
function normalizeExtension(rawExtension: string | undefined | null): string {
  if (!rawExtension || !rawExtension.trim()) throw new ValidationError("Extension required.");

  let ext = rawExtension.trim();
  if (!ext.startsWith(".")) ext = `.${ext}`;
  ext = ext.replace(/\.+$/, "");

  if (ext.length < 2) throw new ValidationError("Extension must be a file extension like .ply");

  let result = ".";
  for (let i = 1; i < ext.length; i++) {
    const c = ext[i];
    if (/[a-zA-Z0-9]/.test(c)) {
      result += c.toLowerCase();
    } else {
      throw new ValidationError("Extension must be a file extension like .ply");
    }
  }

  return result;
}

/** Ported from CloudStorageService.BuildObjectPath. */
export function buildObjectPath(rawDirectoryPath: string, rawFileName: string, rawExtension: string): string {
  const directoryPath = normalizeObjectPath(rawDirectoryPath).replace(/\/+$/, "");
  const fileNameWithoutExtension = sanitizeFileName(rawFileName);
  const extension = normalizeExtension(rawExtension);

  const fullPath = `${directoryPath}/${fileNameWithoutExtension}${extension}`;
  return normalizeObjectPath(fullPath);
}

/** Ported from CloudStorageService.CreateSignedUploadUrlAsync (V4 signed URL for PUT). */
export async function createSignedUploadUrl(input: RequestUploadUrlInput): Promise<SignedUrlResult> {
  if (input.SizeBytes === undefined || input.SizeBytes === null || input.SizeBytes <= 0) {
    throw new ValidationError("SizeBytes must be greater than zero.");
  }
  if (!input.Extension?.trim()) throw new ValidationError("Extension required.");
  if (!input.FileName?.trim()) throw new ValidationError("FileName required.");

  const objectName = buildObjectPath(input.PathFromRoot ?? "", input.FileName, input.Extension);

  const ttlMinutes = env.gcsUrlTtlMinutes;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  const [signedUrl] = await getBucket().file(objectName).getSignedUrl({
    version: "v4",
    action: "write",
    expires: expiresAt,
  });

  return { PathFromRoot: objectName, SignedUrl: signedUrl, ExpiresAt: expiresAt };
}

/** Ported from CloudStorageService.CreateSignedDownloadUrlAsync (V4 signed URL for GET, forces download via Content-Disposition). */
export async function createSignedDownloadUrl(input: RequestDownloadUrlInput): Promise<SignedUrlResult> {
  const objectName = normalizeObjectPath(input.PathFromRoot);
  const segments = objectName.split("/");
  const filename = segments[segments.length - 1];

  const ttlMinutes = env.gcsUrlTtlMinutes;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  const [signedUrl] = await getBucket().file(objectName).getSignedUrl({
    version: "v4",
    action: "read",
    expires: expiresAt,
    responseDisposition: `attachment; filename="${filename}"`,
  });

  return { PathFromRoot: objectName, SignedUrl: signedUrl, ExpiresAt: expiresAt };
}
