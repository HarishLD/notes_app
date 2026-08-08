import { describe, expect, it } from "vitest";
import { createNoteSchema, noteQuerySchema, updateNoteSchema } from "@/lib/validation/note";

describe("createNoteSchema", () => {
  it("passes valid input and returns the trimmed title", () => {
    const result = createNoteSchema.safeParse({
      title: "  Grocery list  ",
      body: "Milk, eggs, coffee.",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: "Grocery list",
      body: "Milk, eggs, coffee.",
    });
  });

  it("rejects a whitespace-only title", () => {
    const result = createNoteSchema.safeParse({
      title: "   ",
      body: "some body",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a title over the max length", () => {
    const result = createNoteSchema.safeParse({
      title: "a".repeat(201),
      body: "some body",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a title at exactly the max length", () => {
    const result = createNoteSchema.safeParse({
      title: "a".repeat(200),
      body: "",
    });

    expect(result.success).toBe(true);
  });

  it("accepts an empty body", () => {
    const result = createNoteSchema.safeParse({
      title: "Title",
      body: "",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a body over the max length", () => {
    const result = createNoteSchema.safeParse({
      title: "Title",
      body: "a".repeat(10001),
    });

    expect(result.success).toBe(false);
  });

  it("accepts an optional tagIds array", () => {
    const result = createNoteSchema.safeParse({ title: "Title", body: "", tagIds: ["tag1", "tag2"] });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.tagIds).toEqual(["tag1", "tag2"]);
  });

  it("leaves tagIds undefined when absent", () => {
    const result = createNoteSchema.safeParse({ title: "Title", body: "" });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.tagIds).toBeUndefined();
  });
});

describe("updateNoteSchema", () => {
  it("rejects an empty object", () => {
    const result = updateNoteSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("passes a partial object with only a title and returns it trimmed", () => {
    const result = updateNoteSchema.safeParse({ title: "  New title  " });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: "New title" });
  });

  it("passes a partial object with only a body", () => {
    const result = updateNoteSchema.safeParse({ body: "New body" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ body: "New body" });
  });

  it("rejects a whitespace-only title", () => {
    const result = updateNoteSchema.safeParse({ title: "   " });

    expect(result.success).toBe(false);
  });

  it("passes an object with only tagIds", () => {
    const result = updateNoteSchema.safeParse({ tagIds: ["tag1"] });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.tagIds).toEqual(["tag1"]);
  });
});

describe("noteQuerySchema", () => {
  it("defaults sort to newest when absent", () => {
    const result = noteQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ sort: "newest" });
  });

  it("rejects an unknown sort value", () => {
    const result = noteQuerySchema.safeParse({ sort: "bogus" });

    expect(result.success).toBe(false);
  });

  it("accepts sort=oldest", () => {
    const result = noteQuerySchema.safeParse({ sort: "oldest" });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.sort).toBe("oldest");
  });

  it("parses a comma-separated tags string into an array of ids", () => {
    const result = noteQuerySchema.safeParse({ tags: "id1, id2,id3" });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.tags).toEqual(["id1", "id2", "id3"]);
  });

  it("leaves tags undefined when absent", () => {
    const result = noteQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.tags).toBeUndefined();
  });

  it("accepts a search string within the max length", () => {
    const result = noteQuerySchema.safeParse({ q: "meeting notes" });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.q).toBe("meeting notes");
  });

  it("rejects a search string over the max length", () => {
    const result = noteQuerySchema.safeParse({ q: "a".repeat(201) });

    expect(result.success).toBe(false);
  });
});
