import { NextResponse } from "next/server";
import { route } from "@/lib/api/handler";
import { parse, parseJson } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/session";
import { createNoteSchema, noteQuerySchema } from "@/lib/validation/note";
import { createNote, listNotes } from "@/lib/notes/service";

export const GET = route(async (req: Request) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const query = parse(noteQuerySchema, Object.fromEntries(url.searchParams));
  const notes = await listNotes(user.id, { sort: query.sort, q: query.q });
  return NextResponse.json(notes, { status: 200 });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser(req);
  const body = await parseJson(req);
  const data = parse(createNoteSchema, body);
  const note = await createNote(user.id, data);
  return NextResponse.json(note, { status: 201 });
});
