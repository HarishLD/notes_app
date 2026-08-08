import { NextResponse } from "next/server";
import { route } from "@/lib/api/handler";
import { parse, parseJson } from "@/lib/api/responses";
import { requireUser } from "@/lib/auth/session";
import { createTagSchema } from "@/lib/validation/tag";
import { createTag, listTags } from "@/lib/tags/service";

export const GET = route(async (req: Request) => {
  const user = await requireUser(req);
  const tags = await listTags(user.id);
  return NextResponse.json(tags, { status: 200 });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser(req);
  const body = await parseJson(req);
  const data = parse(createTagSchema, body);
  const tag = await createTag(user.id, data.name);
  return NextResponse.json(tag, { status: 201 });
});
