import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import type { CreateNoteInput, NoteQueryInput, UpdateNoteInput } from "@/lib/validation/note";
import type { Note, Tag } from "@/lib/generated/prisma/client";

export type NoteWithTags = Note & { tags: Tag[] };

// Tag filtering (tagIds, AND/OR semantics) lands in Phase 10 once that
// choice is made and tested — see DECISIONS.md. Deriving sort/q from the
// same Zod-inferred type keeps this in sync with the query schema.
export type ListNotesOptions = Pick<NoteQueryInput, "sort" | "q">;

const WITH_TAGS = {
  noteTags: { include: { tag: true } },
} as const;

type NoteWithNoteTags = Note & { noteTags: { tag: Tag }[] };

function toNoteWithTags(note: NoteWithNoteTags): NoteWithTags {
  const { noteTags, ...rest } = note;
  return { ...rest, tags: noteTags.map((noteTag) => noteTag.tag) };
}

export async function listNotes(userId: string, options: ListNotesOptions): Promise<NoteWithTags[]> {
  const notes = await prisma.note.findMany({
    where: {
      userId,
      ...(options.q ? { title: { contains: options.q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { createdAt: options.sort === "oldest" ? "asc" : "desc" },
    include: WITH_TAGS,
  });
  return notes.map(toNoteWithTags);
}

export async function getNote(userId: string, noteId: string): Promise<NoteWithTags> {
  const note = await prisma.note.findFirst({
    where: { id: noteId, userId },
    include: WITH_TAGS,
  });
  if (!note) {
    throw new NotFoundError();
  }
  return toNoteWithTags(note);
}

export async function createNote(userId: string, data: CreateNoteInput): Promise<NoteWithTags> {
  const note = await prisma.note.create({
    data: { ...data, userId },
    include: WITH_TAGS,
  });
  return toNoteWithTags(note);
}

export async function updateNote(userId: string, noteId: string, data: UpdateNoteInput): Promise<NoteWithTags> {
  // Ownership lives in this where clause — a mismatched userId means zero
  // rows match, never a row this function then has to check.
  const result = await prisma.note.updateMany({
    where: { id: noteId, userId },
    data,
  });
  if (result.count === 0) {
    throw new NotFoundError();
  }
  // updateMany doesn't return the row itself; re-read it the same
  // ownership-scoped way every other read in this file does.
  return getNote(userId, noteId);
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  const result = await prisma.note.deleteMany({
    where: { id: noteId, userId },
  });
  if (result.count === 0) {
    throw new NotFoundError();
  }
}
