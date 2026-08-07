import { beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

// Deleting User cascades to Note, Tag, and NoteTag (all onDelete: Cascade),
// so this alone is a full truncation. Runs against DATABASE_URL as loaded
// from .env.test by vitest.config.mts's `env` — never the dev database.
beforeEach(async () => {
  await prisma.user.deleteMany();
});
