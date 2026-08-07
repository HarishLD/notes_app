import type { z } from "zod";
import { ValidationError } from "@/lib/errors";

export async function parseJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError({ _body: ["Request body must be valid JSON"] });
  }
}

export function parse<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    // zod types each field as `string[] | undefined` (a field with no
    // issues is just absent), and — since T is generic here — as a mapped
    // type TS can't resolve to a concrete shape. Both are true regardless
    // of what T is; ValidationError wants a clean Record<string, string[]>
    // with no undefined values.
    const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    const fields: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (messages) fields[field] = messages;
    }
    throw new ValidationError(fields);
  }
  return result.data;
}
