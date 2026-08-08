import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import { createTestNote, createTestTag, createTestUser } from "@/test/factories";
import { createNote, deleteNote, getNote, listNotes, updateNote } from "@/lib/notes/service";
import { setNoteTags } from "@/lib/tags/service";

// Small delay so notes created back-to-back get distinct createdAt values —
// otherwise sort-order assertions are flaky against Postgres's millisecond
// timestamp resolution.
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

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

describe("listNotes filtering, sorting, search", () => {
  it("filters by one tag, returning only notes carrying it", async () => {
    const user = await createTestUser();
    const tag = await createTestTag(user.id);
    const tagged = await createTestNote(user.id, { title: "Tagged" });
    await createTestNote(user.id, { title: "Untagged" });
    await setNoteTags(user.id, tagged.id, [tag.id]);

    const notes = await listNotes(user.id, { sort: "newest", tagIds: [tag.id] });

    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe(tagged.id);
  });

  it("filters by two tags using AND semantics — a note must carry every selected tag", async () => {
    const user = await createTestUser();
    const tagA = await createTestTag(user.id);
    const tagB = await createTestTag(user.id);
    const bothTags = await createTestNote(user.id, { title: "Both" });
    const onlyA = await createTestNote(user.id, { title: "Only A" });
    await setNoteTags(user.id, bothTags.id, [tagA.id, tagB.id]);
    await setNoteTags(user.id, onlyA.id, [tagA.id]);

    const notes = await listNotes(user.id, { sort: "newest", tagIds: [tagA.id, tagB.id] });

    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe(bothTags.id);
  });

  it("returns no results when filtering by a tag id that isn't the caller's own", async () => {
    const user = await createTestUser();
    const otherUser = await createTestUser();
    const foreignTag = await createTestTag(otherUser.id);
    await createTestNote(user.id, { title: "My note" });

    const notes = await listNotes(user.id, { sort: "newest", tagIds: [foreignTag.id] });

    expect(notes).toHaveLength(0);
  });

  it("sort newest and oldest return opposite orders", async () => {
    const user = await createTestUser();
    const first = await createTestNote(user.id, { title: "First" });
    await tick();
    const second = await createTestNote(user.id, { title: "Second" });

    const newest = await listNotes(user.id, { sort: "newest" });
    const oldest = await listNotes(user.id, { sort: "oldest" });

    expect(newest.map((note) => note.id)).toEqual([second.id, first.id]);
    expect(oldest.map((note) => note.id)).toEqual([first.id, second.id]);
  });

  it("search matches case-insensitively and on partial titles", async () => {
    const user = await createTestUser();
    const meeting = await createTestNote(user.id, { title: "Meeting Notes" });
    await createTestNote(user.id, { title: "Grocery List" });

    const notes = await listNotes(user.id, { sort: "newest", q: "MEET" });

    expect(notes).toHaveLength(1);
    expect(notes[0].id).toBe(meeting.id);
  });

  it("search does not match on body content", async () => {
    const user = await createTestUser();
    await createTestNote(user.id, { title: "Groceries", body: "Buy milk for the meeting" });

    const notes = await listNotes(user.id, { sort: "newest", q: "meeting" });

    expect(notes).toHaveLength(0);
  });

  it("composes a tag filter, search, and sort in one request", async () => {
    const user = await createTestUser();
    const tag = await createTestTag(user.id);
    const older = await createTestNote(user.id, { title: "Meeting one" });
    await tick();
    const newer = await createTestNote(user.id, { title: "Meeting two" });
    const untaggedMatch = await createTestNote(user.id, { title: "Meeting three" });
    await setNoteTags(user.id, older.id, [tag.id]);
    await setNoteTags(user.id, newer.id, [tag.id]);
    void untaggedMatch; // matches the search but not the tag filter — must be excluded

    const notes = await listNotes(user.id, { sort: "newest", q: "meeting", tagIds: [tag.id] });

    expect(notes.map((note) => note.id)).toEqual([newer.id, older.id]);
  });

  it("never leaks another user's notes when both users apply the same filter", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    const tagA = await createTestTag(userA.id, { name: "work" });
    const tagB = await createTestTag(userB.id, { name: "work" });
    const noteA = await createTestNote(userA.id, { title: "Meeting notes" });
    const noteB = await createTestNote(userB.id, { title: "Meeting notes" });
    await setNoteTags(userA.id, noteA.id, [tagA.id]);
    await setNoteTags(userB.id, noteB.id, [tagB.id]);

    const notesA = await listNotes(userA.id, { sort: "newest", q: "meeting", tagIds: [tagA.id] });
    const notesB = await listNotes(userB.id, { sort: "newest", q: "meeting", tagIds: [tagB.id] });

    expect(notesA).toHaveLength(1);
    expect(notesA[0].id).toBe(noteA.id);
    expect(notesB).toHaveLength(1);
    expect(notesB[0].id).toBe(noteB.id);
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
