import { z } from "zod";

// Custom messages replace zod's defaults (e.g. "Too small: expected string
// to have >=1 characters") with plain language a user would actually read.
const titleField = z.string().trim().min(1, "Title is required.").max(200, "Title must be 200 characters or fewer.");
const bodyField = z.string().max(10000, "Note is too long — 10,000 characters max.");

// The ids of tags to attach — validated for shape only. Ownership (does
// each id actually belong to this user?) is a database question, checked
// in lib/tags/service.ts's setNoteTags, not something a schema can answer.
const tagIdsField = z.array(z.string()).optional();

export const createNoteSchema = z.object({
  title: titleField,
  body: bodyField,
  tagIds: tagIdsField,
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z
  .object({
    title: titleField.optional(),
    body: bodyField.optional(),
    tagIds: tagIdsField,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const noteQuerySchema = z.object({
  // Search params arrive as a single comma-separated string, not an array.
  tags: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        : undefined,
    ),
  sort: z.enum(["newest", "oldest"]).default("newest"),
  q: z.string().max(200).optional(),
});
export type NoteQueryInput = z.infer<typeof noteQuerySchema>;
