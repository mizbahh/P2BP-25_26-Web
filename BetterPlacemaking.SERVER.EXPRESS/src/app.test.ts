import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";

const app = createApp();

describe("app wiring (no Firestore access required)", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("rejects unauthenticated requests to protected user routes", async () => {
    const res = await request(app).get("/api/user");
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated requests to admin routes", async () => {
    const res = await request(app).put("/api/admin/update-role").send({ TargetEmail: "a@b.com", NewRole: "User" });
    expect(res.status).toBe(401);
  });

  it("rejects login with a missing password before touching Firestore", async () => {
    const res = await request(app).post("/api/login/authenticate").send({ email: "a@b.com" });
    expect(res.status).toBe(400);
    expect(res.body.Success).toBe(false);
  });

  it("rejects registration with a missing email before touching Firestore", async () => {
    const res = await request(app).post("/api/register").send({ Password: "hunter22" });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed bearer token", async () => {
    const res = await request(app).get("/api/user").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns 401 from /api/auth/refresh when the refresh cookie is missing", async () => {
    const res = await request(app).post("/api/auth/refresh");
    expect(res.status).toBe(401);
    expect(res.body.Message).toMatch(/refresh token/i);
  });

  it("logout succeeds even with no refresh cookie present", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.Success).toBe(true);
  });

  it("rejects unauthenticated requests to project routes", async () => {
    const res = await request(app).get("/api/project");
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated requests to device routes", async () => {
    const res = await request(app).get("/api/device/project/some-project");
    expect(res.status).toBe(401);
  });
});
