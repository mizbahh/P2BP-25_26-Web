import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFirestore } from "../test/fakeFirestore.js";

const fake = new FakeFirestore();
vi.mock("../config/firebase.js", () => ({ getDb: () => fake }));

const projectService = await import("./projectService.js");

describe("projectService.create", () => {
  it("bootstraps the creator's ProjectOwner membership (migration fix)", async () => {
    const project = await projectService.create(
      { Title: "Test Project", Description: "d", Location: "l" },
      "creator-user-1",
    );

    expect(project.Title).toBe("Test Project");

    const member = fake.peek(`projects/${project.Id}/members/creator-user-1`);
    expect(member).toBeDefined();
    expect(member?.roles).toEqual(["ProjectOwner"]);
    expect(member?.authzVersion).toBe(1);
  });

  it("does not bootstrap membership for any other user", async () => {
    const project = await projectService.create({ Title: "Another" }, "creator-user-2");
    const strangerMember = fake.peek(`projects/${project.Id}/members/some-other-user`);
    expect(strangerMember).toBeUndefined();
  });
});

describe("projectService.update", () => {
  it("overwrites all three fields every call, nulling out omitted ones", async () => {
    const project = await projectService.create({ Title: "T", Description: "D", Location: "L" }, "u1");
    const success = await projectService.update(project.Id, { Title: "New Title" });
    expect(success).toBe(true);

    const doc = fake.peek(`projects/${project.Id}`);
    expect(doc?.Title).toBe("New Title");
    expect(doc?.Description ?? null).toBeNull();
    expect(doc?.Location ?? null).toBeNull();
  });

  it("returns false for a nonexistent project", async () => {
    const success = await projectService.update("does-not-exist", { Title: "x" });
    expect(success).toBe(false);
  });
});
