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
