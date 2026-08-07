import { describe, expect, it } from "vitest";
import { createTestUser } from "@/test/factories";
import { POST } from "../route";

function signinRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/signin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signin", () => {
  it("returns 200 and sets the session cookie for correct credentials", async () => {
    const user = await createTestUser({ password: "correct-password" });

    const res = await POST(signinRequest({ email: user.email, password: "correct-password" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("returns 401 for a wrong password", async () => {
    const user = await createTestUser({ password: "correct-password" });

    const res = await POST(signinRequest({ email: user.email, password: "wrong-password" }));

    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown email", async () => {
    const res = await POST(signinRequest({ email: "nobody@example.com", password: "whatever123" }));

    expect(res.status).toBe(401);
  });

  it("returns the same status and body for an unknown email as for a wrong password", async () => {
    const user = await createTestUser({ password: "correct-password" });

    const wrongPasswordRes = await POST(signinRequest({ email: user.email, password: "wrong-password" }));
    const unknownEmailRes = await POST(signinRequest({ email: "nobody@example.com", password: "wrong-password" }));

    expect(unknownEmailRes.status).toBe(wrongPasswordRes.status);
    expect(await unknownEmailRes.json()).toEqual(await wrongPasswordRes.json());
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("http://localhost/api/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
