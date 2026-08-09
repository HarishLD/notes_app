import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";
import type { CreateNoteInput, NoteQueryInput, UpdateNoteInput } from "@/lib/validation/note";
import type { Note, Tag } from "@/lib/generated/prisma/client";

export type NoteWithTags = Note & { tags: Tag[] };

// tagIds isn't Picked from NoteQueryInput — that type calls the same
// concept "tags" (the query-string param name), and requirements.md's
// Build section for this function calls it "tagIds"; kept both spellings
// rather than force one to match the other for no functional reason.
export type ListNotesOptions = Pick<NoteQueryInput, "sort" | "q"> & { tagIds?: string[] };

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
      // AND semantics: one `some` check per selected tag, combined with
      // AND — the note must have a join row for tag A *and* a (possibly
      // different) join row for tag B, not one row matching both at once
      // (impossible; each NoteTag row has exactly one tagId).
      ...(options.tagIds && options.tagIds.length > 0
        ? { AND: options.tagIds.map((tagId) => ({ noteTags: { some: { tagId } } })) }
        : {}),
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
    throw new NotFoundError("This note doesn't exist or has already been deleted.");
  }
  return toNoteWithTags(note);
}

export async function createNote(userId: string, data: CreateNoteInput): Promise<NoteWithTags> {
  // Named fields, not a blind ...data spread — CreateNoteInput carries an
  // optional tagIds (Phase 9) that isn't a Note column. Tag assignment
  // goes through lib/tags/service.ts's setNoteTags, called separately.
  const note = await prisma.note.create({
    data: { title: data.title, body: data.body, userId },
    include: WITH_TAGS,
  });
  return toNoteWithTags(note);
}

export async function updateNote(userId: string, noteId: string, data: UpdateNoteInput): Promise<NoteWithTags> {
  // Ownership lives in this where clause — a mismatched userId means zero
  // rows match, never a row this function then has to check. Named fields
  // for the same reason as createNote above — tagIds isn't a Note column.
  const result = await prisma.note.updateMany({
    where: { id: noteId, userId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.body !== undefined ? { body: data.body } : {}),
    },
  });
  if (result.count === 0) {
    throw new NotFoundError("This note doesn't exist or has already been deleted.");
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
    throw new NotFoundError("This note doesn't exist or has already been deleted.");
  }
}
