import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

let userCounter = 0;

export type TestUser = {
  id: string;
  email: string;
  // The plaintext, not stored anywhere real — tests need it to exercise signin.
  password: string;
  createdAt: Date;
};

export async function createTestUser(overrides?: { email?: string; password?: string }): Promise<TestUser> {
  userCounter += 1;
  const email = overrides?.email ?? `test-user-${Date.now()}-${userCounter}@example.com`;
  const password = overrides?.password ?? "test-password-123";
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({ data: { email, passwordHash } });

  return { id: user.id, email: user.email, password, createdAt: user.createdAt };
}

let noteCounter = 0;

export type TestNote = {
  id: string;
  title: string;
  body: string;
  userId: string;
  createdAt: Date;
};

export async function createTestNote(
  userId: string,
  overrides?: { title?: string; body?: string },
): Promise<TestNote> {
  noteCounter += 1;
  const title = overrides?.title ?? `Test note ${noteCounter}`;
  const body = overrides?.body ?? "Test body";

  const note = await prisma.note.create({ data: { title, body, userId } });

  return { id: note.id, title: note.title, body: note.body, userId: note.userId, createdAt: note.createdAt };
}

let tagCounter = 0;

export type TestTag = {
  id: string;
  name: string;
  userId: string;
};

export async function createTestTag(userId: string, overrides?: { name?: string }): Promise<TestTag> {
  tagCounter += 1;
  const name = overrides?.name ?? `test-tag-${tagCounter}`;

  const tag = await prisma.tag.create({ data: { name, userId } });

  return { id: tag.id, name: tag.name, userId: tag.userId };
}
