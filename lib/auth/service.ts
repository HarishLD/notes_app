import { prisma } from "@/lib/prisma";
import type { User } from "@/lib/generated/prisma/client";

export type SessionUser = Pick<User, "id" | "email" | "createdAt">;

// The only Prisma access for session reading. select (not include) so
// passwordHash can't leak by accident, per CLAUDE.md §8.
export async function findSessionUser(userId: string): Promise<SessionUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });
}
