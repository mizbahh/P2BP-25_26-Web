import { Router } from "express";
import type { Request } from "express";
import * as boardLibraryService from "../services/boardLibraryService.js";
import { BoardLibraryValidationError } from "../services/boardLibraryService.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { toBoardLibraryItemDto } from "../models/boardLibrary.js";

/**
 * Ported from BetterPlacemaking.SERVER/Controllers/BoardLibraryController.cs.
 * Every endpoint is authenticated-only (no permission check - the ASP.NET
 * controller has none either) and scoped entirely to the caller's own boards;
 * there is no project scoping for this resource.
 */
export const boardLibraryRouter = Router();

boardLibraryRouter.use(requireAuth);

function currentUserId(req: Request): string | undefined {
  return req.user?.sub;
}

boardLibraryRouter.get("/", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    const items = await boardLibraryService.listForUser(userId);
    res.status(200).json(items.map(toBoardLibraryItemDto));
  } catch (err) {
    next(err);
  }
});

boardLibraryRouter.get("/:id", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    if (!req.params.id?.trim()) {
      res.status(400).send("id is required.");
      return;
    }
    const item = await boardLibraryService.getByIdForUser(userId, req.params.id);
    if (!item) {
      res.status(404).send("Board not found.");
      return;
    }
    res.status(200).json(toBoardLibraryItemDto(item));
  } catch (err) {
    next(err);
  }
});

// Matches BoardLibraryController.Save: returns 200 Ok (not 201 Created), ported faithfully.
boardLibraryRouter.post("/", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    const saved = await boardLibraryService.saveForUser(userId, req.body ?? {});
    res.status(200).json(toBoardLibraryItemDto(saved));
  } catch (err) {
    if (err instanceof BoardLibraryValidationError) {
      res.status(400).send(err.message);
      return;
    }
    next(err);
  }
});

boardLibraryRouter.put("/:id", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    if (!req.params.id?.trim()) {
      res.status(400).send("id is required.");
      return;
    }
    const updated = await boardLibraryService.updateForUser(userId, req.params.id, req.body ?? {});
    if (!updated) {
      res.status(404).send("Board not found.");
      return;
    }
    res.status(200).json(toBoardLibraryItemDto(updated));
  } catch (err) {
    if (err instanceof BoardLibraryValidationError) {
      res.status(400).send(err.message);
      return;
    }
    next(err);
  }
});

boardLibraryRouter.delete("/:id", async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    if (!userId) {
      res.status(401).json({ Message: "Missing user id claim." });
      return;
    }
    if (!req.params.id?.trim()) {
      res.status(400).send("id is required.");
      return;
    }
    const deleted = await boardLibraryService.deleteForUser(userId, req.params.id);
    if (!deleted) {
      res.status(404).send("Board not found.");
      return;
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
