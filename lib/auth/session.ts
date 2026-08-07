import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/errors";
import { verifySessionToken } from "@/lib/auth/jwt";
import { findSessionUser, type SessionUser } from "@/lib/auth/service";

const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches the JWT expiry

// Cookies are set on the NextResponse being returned, not via next/headers's
// cookies() — that requires Next's request-scoped AsyncLocalStorage, which
// only exists when Next's own server invokes a route handler. Route handler
// tests call the exported handler directly (per CLAUDE.md §10, no full
// server), so this is the form that works in both production and tests.
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.delete(SESSION_COOKIE_NAME);
}

// Server Components have no response object to attach a cookie to, so
// reading still goes through next/headers's cookies() — that works fine
// there because Next's real render pipeline always provides the request scope.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  // Any failure here — bad token, deleted user — means "no session", not an
  // error worth distinguishing to the caller.
  try {
    const { sub } = await verifySessionToken(token);
    return await findSessionUser(sub);
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
