import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { Prisma, type Tag } from "@/lib/generated/prisma/client";

export async function listTags(userId: string): Promise<Tag[]> {
  return prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

export async function createTag(userId: string, name: string): Promise<Tag> {
  try {
    return await prisma.tag.create({ data: { name, userId } });
  } catch (err) {
    // Prisma's unique constraint violation ([userId, name]) is the one
    // expected failure mode here — converting it to a typed, client-facing
    // error is a deliberate outcome change, not a blanket catch-and-rethrow.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError("Tag already exists");
    }
    throw err;
  }
}

// Replaces a note's tags with exactly the given set. Both ownership checks
// happen before any write — a rejected call leaves every join row for this
// note untouched, whether the rejection is the note or a tag not belonging
// to userId. Wrapped in one transaction so the check-then-write sequence
// can't be interleaved with another request, and so the delete+recreate
// pair can't half-apply.
export async function setNoteTags(userId: string, noteId: string, tagIds: string[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const note = await tx.note.findFirst({ where: { id: noteId, userId } });
    if (!note) {
      throw new NotFoundError();
    }

    if (tagIds.length > 0) {
      const ownedTagCount = await tx.tag.count({ where: { id: { in: tagIds }, userId } });
      if (ownedTagCount !== tagIds.length) {
        throw new NotFoundError();
      }
    }

    await tx.noteTag.deleteMany({ where: { noteId } });
    if (tagIds.length > 0) {
      await tx.noteTag.createMany({ data: tagIds.map((tagId) => ({ noteId, tagId })) });
    }
  });
}
