import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createTestTag, createTestUser } from "@/test/factories";
import { authenticatedRequest } from "@/test/request";
import { GET, POST } from "../route";

describe("GET /api/tags", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/tags");

    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns only the caller's tags", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await createTestTag(userA.id, { name: "work" });
    await createTestTag(userB.id, { name: "personal" });

    const req = await authenticatedRequest(userA.id, "http://localhost/api/tags");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("work");
  });
});

describe("POST /api/tags", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "work" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("creates a tag and returns 201", async () => {
    const user = await createTestUser();
    const req = await authenticatedRequest(user.id, "http://localhost/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Work" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("work");
  });

  it("returns 409 for a duplicate name for the same user", async () => {
    const user = await createTestUser();
    await createTestTag(user.id, { name: "work" });

    const req = await authenticatedRequest(user.id, "http://localhost/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "work" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(409);
  });

  it("returns 400 for an empty name", async () => {
    const user = await createTestUser();
    const req = await authenticatedRequest(user.id, "http://localhost/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const user = await createTestUser();
    const req = await authenticatedRequest(user.id, "http://localhost/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
