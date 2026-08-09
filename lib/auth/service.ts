import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { ConflictError, UnauthorizedError } from "@/lib/errors";
import { Prisma, type User } from "@/lib/generated/prisma/client";

export type SessionUser = Pick<User, "id" | "email" | "createdAt">;

const SAFE_USER_SELECT = { id: true, email: true, createdAt: true } as const;

// A hash with no real password behind it. Comparing against this on the
// unknown-email path costs the same bcrypt time as a real comparison, so
// response timing can't reveal whether an email is registered.
const DUMMY_PASSWORD_HASH = "$2b$12$JqOLqWR/8xg3kRBLMocjLeUuuksJ7voGA8Q0W8fZMkZxQCnx6Ye1O";

// The only Prisma access for session reading. select (not include) so
// passwordHash can't leak by accident, per CLAUDE.md §8.
export async function findSessionUser(userId: string): Promise<SessionUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: SAFE_USER_SELECT,
  });
}

export async function registerUser(email: string, password: string): Promise<SessionUser> {
  const passwordHash = await hashPassword(password);
  try {
    return await prisma.user.create({
      data: { email, passwordHash },
      select: SAFE_USER_SELECT,
    });
  } catch (err) {
    // Prisma's unique constraint violation is the one expected failure mode
    // here — converting it to a typed, client-facing error is a deliberate
    // outcome change, not a blanket catch-and-rethrow.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError("An account with this email already exists. Try signing in instead.");
    }
    throw err;
  }
}

export async function authenticateUser(email: string, password: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...SAFE_USER_SELECT, passwordHash: true },
  });

  // Always run a comparison, even when the user doesn't exist, so response
  // timing doesn't reveal which emails are registered.
  const isValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  // One throw for both branches, one message — an unknown email and a wrong
  // password must stay indistinguishable, so there is deliberately nowhere
  // here to say which one happened.
  if (!user || !isValid) {
    throw new UnauthorizedError("Invalid email or password.");
  }

  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
