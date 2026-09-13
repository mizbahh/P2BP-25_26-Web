import { Router } from "express";
import * as floorplanLibraryService from "../services/floorplanLibraryService.js";
import * as cloudStorageService from "../services/cloudStorageService.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { toFloorplanLibraryItemDto, type FloorplanLibraryItem } from "../models/floorplanLibrary.js";

export const floorplanLibraryRouter = Router();

// Matches FloorplanLibraryController: [Authorize(Policy = "UserJwt")] only - every
// endpoint below is scoped to the caller's own items via userId (req.user.sub), not
// project permissions, so there's no requirePermission() here (ported faithfully,
// not a gap - the ASP.NET controller never checks project roles either).
floorplanLibraryRouter.use(requireAuth);

/**
 * Matches FloorplanLibraryController.ToDtoAsync, which attaches a short-lived signed
 * download URL to every DTO via CloudStorageService.CreateSignedDownloadUrlAsync. Same
 * fallback-to-null behavior as the ASP.NET server if signing fails (e.g. missing
 * iam.serviceAccounts.signBlob credentials in local dev) - a broken signer shouldn't
 * take down the whole list/get response.
 */
async function toDto(item: FloorplanLibraryItem) {
  if (!item.ImagePath) return toFloorplanLibraryItemDto(item, null);
  try {
    const signed = await cloudStorageService.createSignedDownloadUrl({ PathFromRoot: item.ImagePath });
    return toFloorplanLibraryItemDto(item, { url: signed.SignedUrl, expiresAt: signed.ExpiresAt.toISOString() });
  } catch {
    return toFloorplanLibraryItemDto(item, null);
  }
}

floorplanLibraryRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const items = await floorplanLibraryService.listForUser(userId, projectId);
    res.status(200).json(await Promise.all(items.map(toDto)));
  } catch (err) {
    next(err);
  }
});

floorplanLibraryRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    if (!req.params.id?.trim()) {
      res.status(400).send("id is required.");
      return;
    }

    const item = await floorplanLibraryService.getByIdForUser(userId, req.params.id);
    if (!item) {
      res.status(404).send("Floorplan not found.");
      return;
    }
    res.status(200).json(await toDto(item));
  } catch (err) {
    next(err);
  }
});

/**
 * NOTE: FloorplanLibraryController.Upload is `[Consumes("multipart/form-data")]`
 * with a 25MB IFormFile ([RequestSizeLimit(25_000_000)]). This server has no
 * multipart-parsing package (multer/busboy), so the request body is adapted to
 * JSON carrying a base64-encoded image instead:
 *   { ImageBase64, FileName?, ContentType?, Nickname?, ProjectId? }
 * ImageBase64 may be a raw base64 string or a data: URL (the prefix up to the
 * first comma is stripped). app.ts raises express.json()'s body limit to 35mb
 * specifically to accommodate this (25MB image -> ~34MB base64 -> JSON overhead),
 * matching the old server's 25MB cap on the underlying image itself.
 */
floorplanLibraryRouter.post("/upload", async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    const { ImageBase64, FileName, ContentType, Nickname, ProjectId } = req.body ?? {};

    if (!ImageBase64 || typeof ImageBase64 !== "string") {
      res.status(400).send("A floorplan image is required.");
      return;
    }

    const commaIndex = ImageBase64.indexOf(",");
    const base64Data = commaIndex >= 0 ? ImageBase64.slice(commaIndex + 1) : ImageBase64;
    const imageBuffer = Buffer.from(base64Data, "base64");

    const item = await floorplanLibraryService.uploadForUser(userId, {
      ImageBuffer: imageBuffer,
      FileName,
      ContentType,
      Nickname,
      ProjectId,
    });
    res.status(200).json(await toDto(item));
  } catch (err) {
    if (err instanceof floorplanLibraryService.FloorplanValidationError) {
      res.status(400).send(err.message);
      return;
    }
    next(err);
  }
});

floorplanLibraryRouter.put("/:id", async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    if (!req.params.id?.trim()) {
      res.status(400).send("id is required.");
      return;
    }

    const { Nickname, ProjectId, ReferencePoints, ReferenceDistanceMm, MmPerPixel, OriginFp } = req.body ?? {};
    const item = await floorplanLibraryService.updateForUser(userId, req.params.id, {
      Nickname,
      ProjectId,
      ReferencePoints,
      ReferenceDistanceMm,
      MmPerPixel,
      OriginFp,
    });
    res.status(200).json(await toDto(item));
  } catch (err) {
    if (err instanceof floorplanLibraryService.FloorplanValidationError) {
      res.status(400).send(err.message);
      return;
    }
    if (err instanceof floorplanLibraryService.FloorplanNotFoundError) {
      res.status(404).send("Floorplan not found.");
      return;
    }
    next(err);
  }
});

floorplanLibraryRouter.delete("/:id", async (req, res, next) => {
  try {
    const userId = req.user!.sub;
    if (!req.params.id?.trim()) {
      res.status(400).send("id is required.");
      return;
    }

    const deleted = await floorplanLibraryService.deleteForUser(userId, req.params.id);
    if (!deleted) {
      res.status(404).send("Floorplan not found.");
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
