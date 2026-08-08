import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

const PROTECTED_PREFIXES = ["/notes"];
const AUTH_ONLY_PATHS = ["/login", "/signup"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Optimistic cookie-presence check only — no JWT verification, no database
// query. Next.js 16 renamed middleware.ts to proxy.ts and repositioned this
// layer as a routing concern, following a CVE where apps that treated
// middleware as the security boundary could be bypassed. A forged, expired,
// or otherwise invalid cookie passes this check and gets redirected past
// login — the authoritative check is requireUser(), called first by every
// protected route handler and protected server component, which rejects it
// immediately after.
export function proxy(request: NextRequest): NextResponse {
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const { pathname } = request.nextUrl;

  if (isProtectedPath(pathname) && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (AUTH_ONLY_PATHS.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/notes", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/notes", "/notes/:path*", "/login", "/signup"],
};
