import { describe, expect, it } from "vitest";
import { signinSchema, signupSchema } from "@/lib/validation/auth";

describe("signupSchema", () => {
  it("passes valid input and returns the trimmed, lowercased email", () => {
    const result = signupSchema.safeParse({
      email: "  USER@Example.COM  ",
      password: "password123",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      email: "user@example.com",
      password: "password123",
    });
  });

  it("rejects a malformed email", () => {
    const result = signupSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a password under 8 characters", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "short1",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a password of exactly 8 characters", () => {
    const result = signupSchema.safeParse({
      email: "user@example.com",
      password: "exactly8",
    });

    expect(result.success).toBe(true);
  });
});

describe("signinSchema", () => {
  it("passes valid input and returns the trimmed, lowercased email", () => {
    const result = signinSchema.safeParse({
      email: "  USER@Example.COM  ",
      password: "whatever-the-user-typed",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      email: "user@example.com",
      password: "whatever-the-user-typed",
    });
  });

  it("rejects a malformed email", () => {
    const result = signinSchema.safeParse({
      email: "not-an-email",
      password: "whatever-the-user-typed",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a short password since signin enforces presence, not strength", () => {
    const result = signinSchema.safeParse({
      email: "user@example.com",
      password: "x",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = signinSchema.safeParse({
      email: "user@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});
