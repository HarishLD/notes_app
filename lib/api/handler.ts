import { NextResponse } from "next/server";
import { AppError, ValidationError } from "@/lib/errors";

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ValidationError) {
    return NextResponse.json(
      { error: err.message, code: err.code, fields: err.fields },
      { status: err.status },
    );
  }
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  // Unknown failure: log the detail server-side, tell the client nothing.
  console.error("[unhandled]", err);
  return NextResponse.json({ error: "Something went wrong", code: "INTERNAL_ERROR" }, { status: 500 });
}

export function route<Ctx = unknown>(
  fn: (req: Request, ctx: Ctx) => Promise<NextResponse>,
): (req: Request, ctx?: Ctx) => Promise<NextResponse> {
  // ctx is optional here (unlike fn's own signature) so routes with no
  // dynamic segments — signup/signin/signout — can be called with just a
  // Request, which is how CLAUDE.md's own testing strategy calls exported
  // handlers directly. Next.js always supplies ctx for dynamic routes
  // ([id]/route.ts) at runtime, so this only ever matters for tests.
  return async (req, ctx) => {
    try {
      return await fn(req, ctx as Ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
