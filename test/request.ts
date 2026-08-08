import { NextRequest } from "next/server";
import { signSessionToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// NextRequest's constructor wants its own RequestInit (narrower `signal`
// than the DOM lib's), which isn't exported from the public "next/server"
// entry point — deriving it this way avoids importing from Next's internal
// module path. Exported so test files building requests directly (for the
// unauthenticated-request case) can use the same type.
export type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

// Builds a real NextRequest carrying a valid session cookie for userId, so
// route handler tests can call the exported handler directly — no request
// scope, no running server — and still have requireUser(req) resolve a
// real, signed-in user. See DECISIONS.md for why this works.
export async function authenticatedRequest(
  userId: string,
  url: string,
  init?: NextRequestInit,
): Promise<NextRequest> {
  const token = await signSessionToken(userId);
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  return new NextRequest(url, { ...init, headers });
}
