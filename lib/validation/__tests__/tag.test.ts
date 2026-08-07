import { describe, expect, it } from "vitest";
import { createTagSchema } from "@/lib/validation/tag";

describe("createTagSchema", () => {
  it("passes valid input and returns the trimmed, lowercased name", () => {
    const result = createTagSchema.safeParse({ name: "  Work  " });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "work" });
  });

  it("rejects a whitespace-only name", () => {
    const result = createTagSchema.safeParse({ name: "   " });

    expect(result.success).toBe(false);
  });

  it("rejects a name over the max length", () => {
    const result = createTagSchema.safeParse({ name: "a".repeat(41) });

    expect(result.success).toBe(false);
  });

  it("accepts a name at exactly the max length", () => {
    const result = createTagSchema.safeParse({ name: "a".repeat(40) });

    expect(result.success).toBe(true);
  });
});
