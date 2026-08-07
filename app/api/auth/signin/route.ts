import { NextResponse } from "next/server";
import { route } from "@/lib/api/handler";
import { parse, parseJson } from "@/lib/api/responses";
import { signinSchema } from "@/lib/validation/auth";
import { authenticateUser } from "@/lib/auth/service";
import { signSessionToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";

export const POST = route(async (req: Request) => {
  const body = await parseJson(req);
  const data = parse(signinSchema, body);
  // authenticateUser throws UnauthorizedError for both an unknown email and
  // a wrong password — same status, same body, so signin can't be used to
  // enumerate registered emails.
  const user = await authenticateUser(data.email, data.password);
  const token = await signSessionToken(user.id);

  const res = NextResponse.json(user, { status: 200 });
  setSessionCookie(res, token);
  return res;
});
