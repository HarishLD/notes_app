import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/errors";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

describe("signSessionToken / verifySessionToken", () => {
  it("verifies a signed token and its sub matches the input", async () => {
    const token = await signSessionToken("user-123");

    const result = await verifySessionToken(token);

    expect(result.sub).toBe("user-123");
  });

  it("throws UnauthorizedError for a tampered token", async () => {
    const token = await signSessionToken("user-123");
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(verifySessionToken(tampered)).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for a malformed token", async () => {
    await expect(verifySessionToken("not-a-jwt")).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for a token signed with a different secret", async () => {
    const otherSecret = new TextEncoder().encode("a-completely-different-secret-value");
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(otherSecret);

    await expect(verifySessionToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for an expired token", async () => {
    const secretValue = process.env.JWT_SECRET;
    if (!secretValue) throw new Error("JWT_SECRET must be set for this test");
    const secret = new TextEncoder().encode(secretValue);
    const oneDayAgo = Math.floor(Date.now() / 1000) - 60 * 60 * 24;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setIssuedAt(oneDayAgo - 1)
      .setExpirationTime(oneDayAgo)
      .sign(secret);

    await expect(verifySessionToken(token)).rejects.toThrow(UnauthorizedError);
  });
});

describe("module load", () => {
  it("throws when JWT_SECRET is missing", async () => {
    const original = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    vi.resetModules();

    await expect(import("@/lib/auth/jwt")).rejects.toThrow();

    process.env.JWT_SECRET = original;
    vi.resetModules();
  });
});
