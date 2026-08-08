import { NextResponse } from "next/server";
import { route } from "@/lib/api/handler";
import { parse, parseJson } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/session";
import { updateNoteSchema } from "@/lib/validation/note";
import { deleteNote, getNote, updateNote } from "@/lib/notes/service";

type RouteContext = { params: Promise<{ id: string }> };

export const GET = route<RouteContext>(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const note = await getNote(user.id, id);
  return NextResponse.json(note, { status: 200 });
});

export const PATCH = route<RouteContext>(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser(req);
  const body = await parseJson(req);
  const data = parse(updateNoteSchema, body);
  const { id } = await ctx.params;
  const note = await updateNote(user.id, id, data);
  return NextResponse.json(note, { status: 200 });
});

export const DELETE = route<RouteContext>(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  await deleteNote(user.id, id);
  return new NextResponse(null, { status: 204 });
});
