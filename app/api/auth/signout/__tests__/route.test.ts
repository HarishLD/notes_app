import { describe, expect, it } from "vitest";
import { POST } from "../route";

function signoutRequest(): Request {
  return new Request("http://localhost/api/auth/signout", { method: "POST" });
}

describe("POST /api/auth/signout", () => {
  it("returns 200 and clears the session cookie", async () => {
    const res = await POST(signoutRequest());

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("session=");
    expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });

  it("succeeds even when there is no existing session", async () => {
    const res = await POST(signoutRequest());

    expect(res.status).toBe(200);
  });
});
