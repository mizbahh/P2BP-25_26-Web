import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { FakeFirestore } from "../test/fakeFirestore.js";

// boardLibraryRouter isn't wired into app.ts yet (that happens in a follow-up
// step), so these tests mount it directly on a minimal express app rather
// than going through createApp() - avoids depending on other in-flight work.

const fake = new FakeFirestore();
vi.mock("../config/firebase.js", () => ({ getDb: () => fake }));

const { boardLibraryRouter } = await import("./boardLibrary.routes.js");
const { errorHandler } = await import("../middleware/errorHandler.js");
const { createUserToken } = await import("../services/tokenService.js");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/board-library", boardLibraryRouter);
  app.use(errorHandler);
  return app;
}

function authHeader(userId = "user-1"): string {
  const { token } = createUserToken({ Id: userId, Email: "a@b.com", Role: "User" } as never);
  return `Bearer ${token}`;
}

const validCharuco = {
  Type: "charuco",
  Nickname: "My Board",
  Dictionary: "DICT_4X4_50",
  Units: "mm",
  Cols: 5,
  Rows: 7,
  SquareSize: 30,
  MarkerSize: 20,
  PreviewSvg: "<svg></svg>",
};

const validAruco = {
  Type: "aruco",
  Nickname: "My Marker",
  Dictionary: "DICT_5X5_100",
  Units: "cm",
  MarkerId: 12,
  MarkerSize: 5,
  PreviewSvg: "<svg></svg>",
};

describe("GET /api/board-library", () => {
  it("returns only the caller's own boards, newest first", async () => {
    await fake.collection("board_library").doc("mine-old").set({
      UserId: "user-1",
      Type: "charuco",
      Nickname: "Old",
      Dictionary: "DICT_4X4_50",
      Units: "mm",
      Cols: 5,
      Rows: 7,
      SquareSize: 30,
      MarkerSize: 20,
      SquareSizeMm: 30,
      MarkerSizeMm: 20,
      PreviewSvg: "<svg></svg>",
      CreatedAtUtc: { toMillis: () => 1000, toDate: () => new Date(1000) },
    });
    await fake.collection("board_library").doc("mine-new").set({
      UserId: "user-1",
      Type: "charuco",
      Nickname: "New",
      Dictionary: "DICT_4X4_50",
      Units: "mm",
      Cols: 5,
      Rows: 7,
      SquareSize: 30,
      MarkerSize: 20,
      SquareSizeMm: 30,
      MarkerSizeMm: 20,
      PreviewSvg: "<svg></svg>",
      CreatedAtUtc: { toMillis: () => 2000, toDate: () => new Date(2000) },
    });
    await fake.collection("board_library").doc("someone-elses").set({
      UserId: "user-2",
      Type: "charuco",
      Nickname: "Not mine",
      Dictionary: "DICT_4X4_50",
      Units: "mm",
      Cols: 5,
      Rows: 7,
      SquareSize: 30,
      MarkerSize: 20,
      SquareSizeMm: 30,
      MarkerSizeMm: 20,
      PreviewSvg: "<svg></svg>",
      CreatedAtUtc: { toMillis: () => 3000, toDate: () => new Date(3000) },
    });

    const app = buildApp();
    const res = await request(app).get("/api/board-library").set("Authorization", authHeader("user-1"));

    expect(res.status).toBe(200);
    expect(res.body.map((b: { Id: string }) => b.Id)).toEqual(["mine-new", "mine-old"]);
  });

  it("rejects requests without a bearer token", async () => {
    const app = buildApp();
    const res = await request(app).get("/api/board-library");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/board-library/:id", () => {
  it("returns 404 for a board owned by a different user", async () => {
    await fake.collection("board_library").doc("their-board").set({
      UserId: "user-2",
      Type: "charuco",
      Nickname: "Theirs",
      Dictionary: "DICT_4X4_50",
      Units: "mm",
      MarkerSize: 20,
      MarkerSizeMm: 20,
      PreviewSvg: "<svg></svg>",
      CreatedAtUtc: { toMillis: () => 1000, toDate: () => new Date(1000) },
    });

    const app = buildApp();
    const res = await request(app)
      .get("/api/board-library/their-board")
      .set("Authorization", authHeader("user-1"));

    expect(res.status).toBe(404);
  });
});

describe("POST /api/board-library", () => {
  it("saves a valid ChArUco board and converts sizes to millimeters", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/board-library")
      .set("Authorization", authHeader("user-1"))
      .send(validCharuco);

    expect(res.status).toBe(200);
    expect(res.body.Type).toBe("charuco");
    expect(res.body.SquareSizeMm).toBe(30);
    expect(res.body.MarkerSizeMm).toBe(20);
    expect(res.body.Id).toBeTruthy();

    const stored = fake.peek(`board_library/${res.body.Id}`);
    expect(stored?.UserId).toBe("user-1");
  });

  it("saves a valid ArUco board and converts cm to millimeters", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/board-library")
      .set("Authorization", authHeader("user-1"))
      .send(validAruco);

    expect(res.status).toBe(200);
    expect(res.body.Type).toBe("aruco");
    expect(res.body.MarkerSizeMm).toBe(50);
    expect(res.body.MarkerId).toBe(12);
  });

  it("rejects an invalid board type with 400", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/board-library")
      .set("Authorization", authHeader("user-1"))
      .send({ ...validCharuco, Type: "hexagon" });

    expect(res.status).toBe(400);
  });

  it("rejects requests without a bearer token", async () => {
    const app = buildApp();
    const res = await request(app).post("/api/board-library").send(validCharuco);
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/board-library/:id", () => {
  it("updates the caller's own board and preserves CreatedAtUtc", async () => {
    const created = { toMillis: () => 1000, toDate: () => new Date(1000) };
    await fake.collection("board_library").doc("board-1").set({
      UserId: "user-1",
      Type: "charuco",
      Nickname: "Old Name",
      Dictionary: "DICT_4X4_50",
      Units: "mm",
      Cols: 5,
      Rows: 7,
      SquareSize: 30,
      MarkerSize: 20,
      SquareSizeMm: 30,
      MarkerSizeMm: 20,
      PreviewSvg: "<svg></svg>",
      CreatedAtUtc: created,
    });

    const app = buildApp();
    const res = await request(app)
      .put("/api/board-library/board-1")
      .set("Authorization", authHeader("user-1"))
      .send({ ...validCharuco, Nickname: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.Nickname).toBe("New Name");
    expect(res.body.CreatedAtUtc).toBe(new Date(1000).toISOString());
  });

  it("returns 404 when updating a board owned by a different user", async () => {
    await fake.collection("board_library").doc("their-board").set({
      UserId: "user-2",
      Type: "charuco",
      Nickname: "Theirs",
      Dictionary: "DICT_4X4_50",
      Units: "mm",
      MarkerSize: 20,
      MarkerSizeMm: 20,
      PreviewSvg: "<svg></svg>",
      CreatedAtUtc: { toMillis: () => 1000, toDate: () => new Date(1000) },
    });

    const app = buildApp();
    const res = await request(app)
      .put("/api/board-library/their-board")
      .set("Authorization", authHeader("user-1"))
      .send(validCharuco);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/board-library/:id", () => {
  it("deletes the caller's own board", async () => {
    await fake.collection("board_library").doc("board-2").set({
      UserId: "user-1",
      Type: "aruco",
      Nickname: "Delete Me",
      Dictionary: "DICT_5X5_100",
      Units: "cm",
      MarkerId: 1,
      MarkerSize: 5,
      MarkerSizeMm: 50,
      PreviewSvg: "<svg></svg>",
      CreatedAtUtc: { toMillis: () => 1000, toDate: () => new Date(1000) },
    });

    const app = buildApp();
    const res = await request(app).delete("/api/board-library/board-2").set("Authorization", authHeader("user-1"));

    expect(res.status).toBe(204);
    expect(fake.peek("board_library/board-2")).toBeUndefined();
  });

  it("returns 404 when deleting a board owned by a different user, and leaves it intact", async () => {
    await fake.collection("board_library").doc("their-board").set({
      UserId: "user-2",
      Type: "aruco",
      Nickname: "Theirs",
      Dictionary: "DICT_5X5_100",
      Units: "cm",
      MarkerId: 1,
      MarkerSize: 5,
      MarkerSizeMm: 50,
      PreviewSvg: "<svg></svg>",
      CreatedAtUtc: { toMillis: () => 1000, toDate: () => new Date(1000) },
    });

    const app = buildApp();
    const res = await request(app)
      .delete("/api/board-library/their-board")
      .set("Authorization", authHeader("user-1"));

    expect(res.status).toBe(404);
    expect(fake.peek("board_library/their-board")).toBeDefined();
  });

  it("rejects requests without a bearer token", async () => {
    const app = buildApp();
    const res = await request(app).delete("/api/board-library/board-2");
    expect(res.status).toBe(401);
  });
});
