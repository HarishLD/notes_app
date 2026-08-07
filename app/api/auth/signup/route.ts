import { NextResponse } from "next/server";
import { route } from "@/lib/api/handler";
import { parse, parseJson } from "@/lib/api/responses";
import { signupSchema } from "@/lib/validation/auth";
import { registerUser } from "@/lib/auth/service";
import { signSessionToken } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";

export const POST = route(async (req: Request) => {
  const body = await parseJson(req);
  const data = parse(signupSchema, body);
  const user = await registerUser(data.email, data.password);
  const token = await signSessionToken(user.id);

  const res = NextResponse.json(user, { status: 201 });
  setSessionCookie(res, token);
  return res;
});
