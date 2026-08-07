import { NextResponse } from "next/server";
import { route } from "@/lib/api/handler";
import { clearSessionCookie } from "@/lib/auth/session";

// Idempotent by construction — clearing a cookie that was never set is a
// no-op, so there's nothing to check before doing it.
export const POST = route(async () => {
  const res = NextResponse.json({ success: true }, { status: 200 });
  clearSessionCookie(res);
  return res;
});
