import cookieParser from "cookie-parser";
import express from "express";
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { FakeFirestore } from "../test/fakeFirestore.js";

const fake = new FakeFirestore();
vi.mock("../config/firebase.js", () => ({ getDb: () => fake }));

// Wiring floorplanLibraryService's real upload/signed-download-URL calls now hit
// config/storage.js (see uploadImageBytes / cloudStorage.routes.test.ts for the same
// pattern) - mocked here so tests never touch real GCS.
const save = vi.fn(async () => undefined);
const getSignedUrl = vi.fn(async () => ["https://storage.googleapis.com/fake-bucket/signed?action=read"]);
vi.mock("../config/storage.js", () => ({
  getStorage: () => ({ bucket: () => ({ file: () => ({ save, getSignedUrl }) }) }),
  getBucket: () => ({ file: () => ({ save, getSignedUrl }) }),
}));

// floorplanLibraryRouter isn't wired into app.ts yet (that happens in a follow-up
// step), so tests build a minimal app around the router directly instead of using
// createApp() - mirroring what createApp() does for JSON body parsing and the
// shared error handler.
const { floorplanLibraryRouter } = await import("./floorplanLibrary.routes.js");
const { errorHandler } = await import("../middleware/errorHandler.js");
const { createUserToken } = await import("../services/tokenService.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/floorplan-library", floorplanLibraryRouter);
  app.use(errorHandler);
  return app;
}

function authHeader(userId: string): string {
  const { token } = createUserToken({ Id: userId, Email: "a@b.com", Role: "User" } as never);
  return `Bearer ${token}`;
}

/** Builds a minimal-but-header-valid PNG buffer: 8-byte signature + IHDR chunk
 * carrying width/height at the exact offsets FloorplanLibraryService.ReadImageDimensions
 * (and its ported equivalent) read from - enough for the service's image validation,
 * without needing a real decodable image. */
function makePngBase64(width: number, height: number): string {
  const buf = Buffer.alloc(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // PNG signature
  buf.writeUInt32BE(13, 8); // IHDR chunk length (unused by the reader, kept realistic)
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf.toString("base64");
}

describe("GET /api/floorplan-library", () => {
  it("returns only the caller's own floorplans, newest first", async () => {
    await fake.collection("floorplan_library").doc("fp-1").set({
      UserId: "user-1",
      Nickname: "Older",
      ImageContentType: "image/png",
      ImageSizeBytes: 10,
      ImageWidth: 10,
      ImageHeight: 10,
      CreatedAtUtc: "2024-01-01T00:00:00.000Z",
      UpdatedAtUtc: "2024-01-01T00:00:00.000Z",
    });
    await fake.collection("floorplan_library").doc("fp-2").set({
      UserId: "user-1",
      Nickname: "Newer",
      ImageContentType: "image/png",
      ImageSizeBytes: 10,
      ImageWidth: 10,
      ImageHeight: 10,
      CreatedAtUtc: "2024-02-01T00:00:00.000Z",
      UpdatedAtUtc: "2024-02-01T00:00:00.000Z",
    });
    await fake.collection("floorplan_library").doc("fp-other").set({
      UserId: "user-2",
      Nickname: "Someone else's",
      ImageContentType: "image/png",
      ImageSizeBytes: 10,
      ImageWidth: 10,
      ImageHeight: 10,
      CreatedAtUtc: "2024-01-15T00:00:00.000Z",
      UpdatedAtUtc: "2024-01-15T00:00:00.000Z",
    });

    const res = await request(buildApp()).get("/api/floorplan-library").set("Authorization", authHeader("user-1"));

    expect(res.status).toBe(200);
    expect(res.body.map((i: { Nickname: string }) => i.Nickname)).toEqual(["Newer", "Older"]);
  });

  it("rejects requests with no bearer token", async () => {
    const res = await request(buildApp()).get("/api/floorplan-library");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/floorplan-library/:id", () => {
  it("returns the item when it belongs to the caller", async () => {
    await fake.collection("floorplan_library").doc("fp-mine").set({
      UserId: "user-1",
      Nickname: "Mine",
      ImageContentType: "image/png",
      ImageSizeBytes: 10,
      ImageWidth: 10,
      ImageHeight: 10,
      CreatedAtUtc: "2024-01-01T00:00:00.000Z",
      UpdatedAtUtc: "2024-01-01T00:00:00.000Z",
    });

    const res = await request(buildApp())
      .get("/api/floorplan-library/fp-mine")
      .set("Authorization", authHeader("user-1"));

    expect(res.status).toBe(200);
    expect(res.body.Id).toBe("fp-mine");
    expect(res.body.Nickname).toBe("Mine");
  });

  it("returns 404 for another user's item instead of leaking it", async () => {
    await fake.collection("floorplan_library").doc("fp-theirs").set({
      UserId: "user-2",
      Nickname: "Theirs",
      ImageContentType: "image/png",
      ImageSizeBytes: 10,
      ImageWidth: 10,
      ImageHeight: 10,
      CreatedAtUtc: "2024-01-01T00:00:00.000Z",
      UpdatedAtUtc: "2024-01-01T00:00:00.000Z",
    });

    const res = await request(buildApp())
      .get("/api/floorplan-library/fp-theirs")
      .set("Authorization", authHeader("user-1"));

    expect(res.status).toBe(404);
  });

  it("rejects requests with no bearer token", async () => {
    const res = await request(buildApp()).get("/api/floorplan-library/fp-mine");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/floorplan-library/upload", () => {
  it("stores metadata and computed image dimensions for a valid image", async () => {
    const res = await request(buildApp())
      .post("/api/floorplan-library/upload")
      .set("Authorization", authHeader("user-1"))
      .send({
        ImageBase64: makePngBase64(200, 100),
        FileName: "ground-floor.png",
        ContentType: "image/png",
        Nickname: "Ground Floor",
        ProjectId: "proj-1",
      });

    expect(res.status).toBe(200);
    expect(res.body.Nickname).toBe("Ground Floor");
    expect(res.body.ProjectId).toBe("proj-1");
    expect(res.body.ImageWidth).toBe(200);
    expect(res.body.ImageHeight).toBe(100);
    expect(res.body.ImagePath).toContain("users/user-1/floorplans/proj-1/");
    expect(res.body.ImageDownloadUrl).toBe("https://storage.googleapis.com/fake-bucket/signed?action=read");
    expect(save).toHaveBeenCalledWith(expect.any(Buffer), expect.objectContaining({ contentType: "image/png" }));

    const stored = fake.peek(`floorplan_library/${res.body.Id}`);
    expect(stored?.UserId).toBe("user-1");
  });

  it("rejects a non-image content type", async () => {
    const res = await request(buildApp())
      .post("/api/floorplan-library/upload")
      .set("Authorization", authHeader("user-1"))
      .send({ ImageBase64: makePngBase64(10, 10), ContentType: "application/pdf" });

    expect(res.status).toBe(400);
  });

  it("rejects requests with no bearer token", async () => {
    const res = await request(buildApp())
      .post("/api/floorplan-library/upload")
      .send({ ImageBase64: makePngBase64(10, 10), ContentType: "image/png" });
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/floorplan-library/:id", () => {
  it("updates nickname and derives MmPerPixel from reference points", async () => {
    await fake.collection("floorplan_library").doc("fp-1").set({
      UserId: "user-1",
      Nickname: "Old Name",
      ImageContentType: "image/png",
      ImageSizeBytes: 10,
      ImageWidth: 100,
      ImageHeight: 100,
      CreatedAtUtc: "2024-01-01T00:00:00.000Z",
      UpdatedAtUtc: "2024-01-01T00:00:00.000Z",
    });

    const res = await request(buildApp())
      .put("/api/floorplan-library/fp-1")
      .set("Authorization", authHeader("user-1"))
      .send({
        Nickname: "New Name",
        ReferencePoints: [
          [0, 0],
          [10, 0],
        ],
        ReferenceDistanceMm: 1000,
      });

    expect(res.status).toBe(200);
    expect(res.body.Nickname).toBe("New Name");
    expect(res.body.Calibration.MmPerPixel).toBeCloseTo(100);
    expect(res.body.Calibration.ReferencePoints).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });

  it("returns 404 when updating another user's item", async () => {
    await fake.collection("floorplan_library").doc("fp-theirs").set({
      UserId: "user-2",
      Nickname: "Theirs",
      ImageContentType: "image/png",
      ImageSizeBytes: 10,
      ImageWidth: 10,
      ImageHeight: 10,
      CreatedAtUtc: "2024-01-01T00:00:00.000Z",
      UpdatedAtUtc: "2024-01-01T00:00:00.000Z",
    });

    const res = await request(buildApp())
      .put("/api/floorplan-library/fp-theirs")
      .set("Authorization", authHeader("user-1"))
      .send({ Nickname: "Hijacked" });

    expect(res.status).toBe(404);
  });

  it("rejects requests with no bearer token", async () => {
    const res = await request(buildApp()).put("/api/floorplan-library/fp-1").send({ Nickname: "New Name" });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/floorplan-library/:id", () => {
  it("deletes the caller's own item", async () => {
    await fake.collection("floorplan_library").doc("fp-1").set({
      UserId: "user-1",
      Nickname: "Delete Me",
      ImageContentType: "image/png",
      ImageSizeBytes: 10,
      ImageWidth: 10,
      ImageHeight: 10,
      CreatedAtUtc: "2024-01-01T00:00:00.000Z",
      UpdatedAtUtc: "2024-01-01T00:00:00.000Z",
    });

    const res = await request(buildApp())
      .delete("/api/floorplan-library/fp-1")
      .set("Authorization", authHeader("user-1"));

    expect(res.status).toBe(204);
    expect(fake.peek("floorplan_library/fp-1")).toBeUndefined();
  });

  it("returns 404 when deleting another user's item, and leaves it intact", async () => {
    await fake.collection("floorplan_library").doc("fp-theirs").set({
      UserId: "user-2",
      Nickname: "Theirs",
      ImageContentType: "image/png",
      ImageSizeBytes: 10,
      ImageWidth: 10,
      ImageHeight: 10,
      CreatedAtUtc: "2024-01-01T00:00:00.000Z",
      UpdatedAtUtc: "2024-01-01T00:00:00.000Z",
    });

    const res = await request(buildApp())
      .delete("/api/floorplan-library/fp-theirs")
      .set("Authorization", authHeader("user-1"));

    expect(res.status).toBe(404);
    expect(fake.peek("floorplan_library/fp-theirs")).toBeDefined();
  });

  it("rejects requests with no bearer token", async () => {
    const res = await request(buildApp()).delete("/api/floorplan-library/fp-1");
    expect(res.status).toBe(401);
  });
});
