import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTestNote, createTestUser } from "@/test/factories";
import { authenticatedRequest } from "@/test/request";
import { DELETE, GET, PATCH } from "../route";

function ctxFor(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/notes/[id]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/notes/anything");

    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's note", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const note = await createTestNote(owner.id);

    const req = await authenticatedRequest(intruder.id, `http://localhost/api/notes/${note.id}`);
    const res = await GET(req, ctxFor(note.id));

    expect(res.status).toBe(404);
  });

  it("returns the note for its owner", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id, { title: "Mine" });

    const req = await authenticatedRequest(user.id, `http://localhost/api/notes/${note.id}`);
    const res = await GET(req, ctxFor(note.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Mine");
  });
});

describe("PATCH /api/notes/[id]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/notes/anything", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "New" }),
    });

    const res = await PATCH(req);

    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's note", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const note = await createTestNote(owner.id, { title: "Original" });

    const req = await authenticatedRequest(intruder.id, `http://localhost/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Hacked" }),
    });
    const res = await PATCH(req, ctxFor(note.id));

    expect(res.status).toBe(404);
  });

  it("returns 400 for malformed JSON", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id);

    const req = await authenticatedRequest(user.id, `http://localhost/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });
    const res = await PATCH(req, ctxFor(note.id));

    expect(res.status).toBe(400);
  });

  it("updates the note for its owner", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id, { title: "Original" });

    const req = await authenticatedRequest(user.id, `http://localhost/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated" }),
    });
    const res = await PATCH(req, ctxFor(note.id));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.title).toBe("Updated");
  });
});

describe("DELETE /api/notes/[id]", () => {
  it("returns 401 with no session", async () => {
    const req = new NextRequest("http://localhost/api/notes/anything", { method: "DELETE" });

    const res = await DELETE(req);

    expect(res.status).toBe(401);
  });

  it("returns 404 for another user's note", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const note = await createTestNote(owner.id);

    const req = await authenticatedRequest(intruder.id, `http://localhost/api/notes/${note.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, ctxFor(note.id));

    expect(res.status).toBe(404);
  });

  it("deletes an own note and returns 204", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id);

    const req = await authenticatedRequest(user.id, `http://localhost/api/notes/${note.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, ctxFor(note.id));

    expect(res.status).toBe(204);
    const gone = await prisma.note.findUnique({ where: { id: note.id } });
    expect(gone).toBeNull();
  });
});
