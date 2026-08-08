import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { UnauthorizedError } from "@/lib/errors";
import { verifySessionToken } from "@/lib/auth/jwt";
import { findSessionUser, type SessionUser } from "@/lib/auth/service";

// Exported so proxy.ts's optimistic presence check reads the same name —
// one source of truth for what the session cookie is called.
export const SESSION_COOKIE_NAME = "session";
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

// Reading has the same request-scope problem writing did in Phase 4, but no
// NextResponse-based trick applies here — there's nothing to attach a read
// to. Route handlers always receive a genuine NextRequest at runtime (Next
// guarantees this), even though lib/api/handler.ts's route() wrapper types
// it as the more general Request — so a route handler can hand its req
// straight to getCurrentUser/requireUser, and this is the one place that
// narrows it back to NextRequest to read .cookies directly off the request.
// That needs no AsyncLocalStorage, so it works identically whether Next's
// server invoked the handler or a test constructed a NextRequest and called
// the exported handler directly.
async function readSessionToken(request?: Request): Promise<string | undefined> {
  if (request) {
    return (request as NextRequest).cookies.get(SESSION_COOKIE_NAME)?.value;
  }
  // Server Components have no request object to read from — next/headers's
  // cookies() works fine there because Next's real render pipeline always
  // provides the request scope it needs.
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function getCurrentUser(request?: Request): Promise<SessionUser | null> {
  const token = await readSessionToken(request);
  if (!token) {
    return null;
  }
  let sub: string;
  try {
    // Bad signature, malformed token, expired — genuinely "no session",
    // not an error worth distinguishing to the caller.
    ({ sub } = await verifySessionToken(token));
  } catch {
    return null;
  }
  // Deliberately not wrapped in the try/catch above: a deleted user is
  // findSessionUser resolving to null (Prisma returns null, it doesn't
  // throw), which is still "no session." A database outage is a different
  // failure entirely and must not be swallowed the same way — that would
  // silently redirect a signed-in user to /login instead of surfacing the
  // real error (Phase 11 audit: caught by manually breaking DATABASE_URL).
  return await findSessionUser(sub);
}

export async function requireUser(request?: Request): Promise<SessionUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
