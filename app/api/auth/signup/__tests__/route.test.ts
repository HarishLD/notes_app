import { describe, expect, it } from "vitest";
import { createTestUser } from "@/test/factories";
import { POST } from "../route";

function signupRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  it("returns 201 and sets an HttpOnly session cookie for valid input", async () => {
    const res = await POST(signupRequest({ email: "new-user@example.com", password: "password123" }));

    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("returns the created user's id and email", async () => {
    const res = await POST(signupRequest({ email: "new-user@example.com", password: "password123" }));
    const body = await res.json();

    expect(body).toMatchObject({ email: "new-user@example.com" });
    expect(body.id).toEqual(expect.any(String));
  });

  it("never returns a passwordHash", async () => {
    const res = await POST(signupRequest({ email: "new-user@example.com", password: "password123" }));
    const body = await res.json();

    expect(body).not.toHaveProperty("passwordHash");
  });

  it("returns 409 when the email is already registered", async () => {
    const existing = await createTestUser();

    const res = await POST(signupRequest({ email: existing.email, password: "password123" }));

    expect(res.status).toBe(409);
  });

  it("returns 400 for an invalid email", async () => {
    const res = await POST(signupRequest({ email: "not-an-email", password: "password123" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 for a password under 8 characters", async () => {
    const res = await POST(signupRequest({ email: "new-user@example.com", password: "short1" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
