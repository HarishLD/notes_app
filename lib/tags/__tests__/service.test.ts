import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { createTestNote, createTestTag, createTestUser } from "@/test/factories";
import { deleteNote } from "@/lib/notes/service";
import { createTag, listTags, setNoteTags } from "@/lib/tags/service";

describe("listTags", () => {
  it("returns only the caller's tags", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await createTestTag(userA.id, { name: "work" });
    await createTestTag(userB.id, { name: "personal" });

    const tags = await listTags(userA.id);

    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("work");
  });
});

describe("createTag", () => {
  it("throws ConflictError for a duplicate name for the same user", async () => {
    const user = await createTestUser();
    await createTestTag(user.id, { name: "work" });

    await expect(createTag(user.id, "work")).rejects.toThrow(ConflictError);
  });

  it("allows two different users to create a tag with the same name", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    await createTestTag(userA.id, { name: "work" });

    const tag = await createTag(userB.id, "work");

    expect(tag.name).toBe("work");
    expect(tag.userId).toBe(userB.id);
  });
});

describe("setNoteTags", () => {
  it("throws NotFoundError for another user's note id", async () => {
    const owner = await createTestUser();
    const intruder = await createTestUser();
    const note = await createTestNote(owner.id);
    const tag = await createTestTag(intruder.id);

    await expect(setNoteTags(intruder.id, note.id, [tag.id])).rejects.toThrow(NotFoundError);
  });

  it("rejects another user's tag id and writes no join rows", async () => {
    const user = await createTestUser();
    const otherUser = await createTestUser();
    const note = await createTestNote(user.id);
    const ownTag = await createTestTag(user.id);
    const foreignTag = await createTestTag(otherUser.id);

    await expect(setNoteTags(user.id, note.id, [ownTag.id, foreignTag.id])).rejects.toThrow(NotFoundError);

    const joinRows = await prisma.noteTag.findMany({ where: { noteId: note.id } });
    expect(joinRows).toHaveLength(0);
  });

  it("lets a note hold multiple tags and a tag be on multiple notes", async () => {
    const user = await createTestUser();
    const noteA = await createTestNote(user.id);
    const noteB = await createTestNote(user.id);
    const tag1 = await createTestTag(user.id);
    const tag2 = await createTestTag(user.id);

    await setNoteTags(user.id, noteA.id, [tag1.id, tag2.id]);
    await setNoteTags(user.id, noteB.id, [tag1.id]);

    const noteATags = await prisma.noteTag.findMany({ where: { noteId: noteA.id } });
    const tag1Notes = await prisma.noteTag.findMany({ where: { tagId: tag1.id } });

    expect(noteATags).toHaveLength(2);
    expect(tag1Notes).toHaveLength(2);
  });

  it("replaces the note's previous tags with the new set", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id);
    const tag1 = await createTestTag(user.id);
    const tag2 = await createTestTag(user.id);

    await setNoteTags(user.id, note.id, [tag1.id]);
    await setNoteTags(user.id, note.id, [tag2.id]);

    const joinRows = await prisma.noteTag.findMany({ where: { noteId: note.id } });
    expect(joinRows.map((row) => row.tagId)).toEqual([tag2.id]);
  });
});

describe("deleting a note", () => {
  it("removes its join rows but leaves the tags", async () => {
    const user = await createTestUser();
    const note = await createTestNote(user.id);
    const tag = await createTestTag(user.id);
    await setNoteTags(user.id, note.id, [tag.id]);

    await deleteNote(user.id, note.id);

    const joinRows = await prisma.noteTag.findMany({ where: { tagId: tag.id } });
    const tagStillExists = await prisma.tag.findUnique({ where: { id: tag.id } });

    expect(joinRows).toHaveLength(0);
    expect(tagStillExists).not.toBeNull();
  });
});
