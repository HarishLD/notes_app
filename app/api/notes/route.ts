import { NextResponse } from "next/server";
import { route } from "@/lib/api/handler";
import { parse, parseJson } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/session";
import { createNoteSchema, noteQuerySchema } from "@/lib/validation/note";
import { createNote, getNote, listNotes } from "@/lib/notes/service";
import { setNoteTags } from "@/lib/tags/service";

export const GET = route(async (req: Request) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const query = parse(noteQuerySchema, Object.fromEntries(url.searchParams));
  const notes = await listNotes(user.id, { sort: query.sort, q: query.q, tagIds: query.tags });
  return NextResponse.json(notes, { status: 200 });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser(req);
  const body = await parseJson(req);
  const data = parse(createNoteSchema, body);
  const note = await createNote(user.id, data);

  // Not atomic with the create above — setNoteTags runs as its own
  // transaction (see lib/tags/service.ts). A tagId that doesn't belong to
  // the caller means the note now exists without the requested tags, and
  // this returns 404 rather than 201. Documented tradeoff, see DECISIONS.md.
  if (data.tagIds && data.tagIds.length > 0) {
    await setNoteTags(user.id, note.id, data.tagIds);
    const noteWithTags = await getNote(user.id, note.id);
    return NextResponse.json(noteWithTags, { status: 201 });
  }

  return NextResponse.json(note, { status: 201 });
});
