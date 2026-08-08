import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createTestNote, createTestUser } from "@/test/factories";
import { authenticatedRequest } from "@/test/request";
import { GET, POST } from "../route";

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("GET /api/notes", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/notes");

    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns only the caller's notes", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await createTestNote(userA.id, { title: "A's note" });
    await createTestNote(userB.id, { title: "B's note" });

    const req = await authenticatedRequest(userA.id, "http://localhost/api/notes");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe("A's note");
  });
});

describe("POST /api/notes", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/notes", jsonInit("POST", { title: "Test", body: "" }));

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("returns 400 for an empty title", async () => {
    const user = await createTestUser();
    const req = await authenticatedRequest(
      user.id,
      "http://localhost/api/notes",
      jsonInit("POST", { title: "", body: "" }),
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const user = await createTestUser();
    const req = await authenticatedRequest(user.id, "http://localhost/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("creates a note for the caller and returns 201", async () => {
    const user = await createTestUser();
    const req = await authenticatedRequest(
      user.id,
      "http://localhost/api/notes",
      jsonInit("POST", { title: "New note", body: "Body" }),
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.title).toBe("New note");
    expect(body.userId).toBe(user.id);
  });
});
