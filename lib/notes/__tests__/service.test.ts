import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { createTestNote, createTestTag, createTestUser } from "@/test/factories";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "@/lib/notes/service";

describe("listNotes", () => {
  it("returns only the caller's notes", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await createTestNote(userA.id, { title: "A's note" });
    await createTestNote(userB.id, { title: "B's note" });

    const notes = await listNotes(userA.id, { sort: "newest" });

    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("A's note");
  });

  it("returns notes with their tags attached", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id);
    const tag = await prisma.tag.create({ data: { name: "work", userId: user.id } });
    await prisma.noteTag.create({ data: { noteId: note.id, tagId: tag.id } });

    const notes = await listNotes(user.id, { sort: "newest" });

    expect(notes[0].tags).toEqual([expect.objectContaining({ id: tag.id, name: "work" })]);
  });
});

describe("getNote", () => {
  it("throws NotFoundError for another user's note id", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const note = await createTestNote(owner.id);

    await expect(getNote(intruder.id, note.id)).rejects.toThrow(NotFoundError);
  });

  it("throws NotFoundError for a non-existent id", async () => {
    const user = await createTestUser();

    await expect(getNote(user.id, "non-existent-id")).rejects.toThrow(NotFoundError);
  });

  it("returns the note for its owner", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id, { title: "Mine" });

    const result = await getNote(user.id, note.id);

    expect(result.title).toBe("Mine");
  });
});

describe("createNote", () => {
  it("assigns the note to the calling user", async () => {
    const user = await createTestUser();

    const note = await createNote(user.id, { title: "New note", body: "Body" });

    expect(note.userId).toBe(user.id);
  });

  it("creates a note with no tags attached", async () => {
    const user = await createTestUser();

    const note = await createNote(user.id, { title: "New note", body: "Body" });

    expect(note.tags).toEqual([]);
  });

  it("ignores a tagIds field on the input instead of passing it to Prisma", async () => {
    // createNoteSchema/updateNoteSchema's inferred type carries an optional
    // tagIds field (Phase 9) that isn't a Note column — tag assignment goes
    // through lib/tags/service.ts's setNoteTags, called separately by the
    // route handler. createNote must not blindly spread its whole input
    // into prisma.note.create's data, or this throws a Prisma validation
    // error at runtime.
    const user = await createTestUser();
    const tag = await createTestTag(user.id);

    const note = await createNote(user.id, { title: "Title", body: "Body", tagIds: [tag.id] });

    expect(note.title).toBe("Title");
  });
});

describe("updateNote", () => {
  it("throws NotFoundError for another user's note id and leaves the row unchanged", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const note = await createTestNote(owner.id, { title: "Original" });

    await expect(updateNote(intruder.id, note.id, { title: "Hacked" })).rejects.toThrow(NotFoundError);

    const unchanged = await prisma.note.findUnique({ where: { id: note.id } });
    expect(unchanged?.title).toBe("Original");
  });

  it("updates the note for its owner", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id, { title: "Original" });

    const updated = await updateNote(user.id, note.id, { title: "Updated" });

    expect(updated.title).toBe("Updated");
  });

  it("ignores a tagIds field on the input instead of passing it to Prisma", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id, { title: "Original" });
    const tag = await createTestTag(user.id);

    const updated = await updateNote(user.id, note.id, { title: "Updated", tagIds: [tag.id] });

    expect(updated.title).toBe("Updated");
  });
});

describe("deleteNote", () => {
  it("throws NotFoundError for another user's note id, and the row still exists afterwards", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const note = await createTestNote(owner.id);

    await expect(deleteNote(intruder.id, note.id)).rejects.toThrow(NotFoundError);

    const stillExists = await prisma.note.findUnique({ where: { id: note.id } });
    expect(stillExists).not.toBeNull();
  });

  it("deletes the note for its owner", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id);

    await deleteNote(user.id, note.id);

    const gone = await prisma.note.findUnique({ where: { id: note.id } });
    expect(gone).toBeNull();
  });
});
