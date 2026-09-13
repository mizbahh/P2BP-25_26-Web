import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const getSignedUrl = vi.fn(async (opts: { action: "read" | "write" }) => {
  return [`https://storage.googleapis.com/fake-bucket/signed?action=${opts.action}`];
});
const file = vi.fn(() => ({ getSignedUrl }));

vi.mock("../config/storage.js", () => ({
  getStorage: () => ({ bucket: () => ({ file }) }),
  getBucket: () => ({ file }),
}));

// cloudStorageRouter isn't wired into app.ts yet (that happens in a follow-up step once every
// ported resource lands), so these tests build a minimal app around the router directly rather
// than importing createApp from ../app.js.
const { cloudStorageRouter } = await import("./cloudStorage.routes.js");
const { errorHandler } = await import("../middleware/errorHandler.js");
const { createUserToken } = await import("../services/tokenService.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/cloud-storage", cloudStorageRouter);
  app.use(errorHandler);
  return app;
}

function authHeader(): string {
  const { token } = createUserToken({ Id: "user-1", Email: "a@b.com", Role: "User" } as never);
  return `Bearer ${token}`;
}

beforeEach(() => {
  getSignedUrl.mockClear();
  file.mockClear();
});

describe("POST /api/cloud-storage/request-upload", () => {
  it("returns a signed PUT URL for a sanitized object path when authenticated", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/cloud-storage/request-upload")
      .set("Authorization", authHeader())
      .send({ PathFromRoot: "projects/proj-1/scans", FileName: "raw scan", Extension: "ply", SizeBytes: 1024 });

    expect(res.status).toBe(200);
    expect(res.body.PathFromRoot).toBe("projects/proj-1/scans/raw scan.ply");
    expect(res.body.SignedUrl).toContain("action=write");
    expect(res.body.ExpiresAt).toBeTruthy();
    expect(file).toHaveBeenCalledWith("projects/proj-1/scans/raw scan.ply");
  });

  it("rejects requests without a valid bearer token", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/cloud-storage/request-upload")
      .send({ PathFromRoot: "projects/proj-1/scans", FileName: "raw scan", Extension: "ply", SizeBytes: 1024 });

    expect(res.status).toBe(401);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("rejects a non-positive SizeBytes with 400", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/cloud-storage/request-upload")
      .set("Authorization", authHeader())
      .send({ PathFromRoot: "projects/proj-1/scans", FileName: "raw scan", Extension: "ply", SizeBytes: 0 });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/cloud-storage/request-download", () => {
  it("returns a signed GET URL with a forced-download disposition when authenticated", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/cloud-storage/request-download")
      .set("Authorization", authHeader())
      .send({ PathFromRoot: "projects/proj-1/scans/raw scan.ply" });

    expect(res.status).toBe(200);
    expect(res.body.PathFromRoot).toBe("projects/proj-1/scans/raw scan.ply");
    expect(res.body.SignedUrl).toContain("action=read");
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ action: "read", responseDisposition: expect.stringContaining("raw scan.ply") }),
    );
  });

  it("rejects requests without a valid bearer token", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/cloud-storage/request-download")
      .send({ PathFromRoot: "projects/proj-1/scans/raw scan.ply" });

    expect(res.status).toBe(401);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
