import { z } from "zod";

const titleField = z.string().trim().min(1).max(200);
const bodyField = z.string().max(10000);

export const createNoteSchema = z.object({
  title: titleField,
  body: bodyField,
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z
  .object({
    title: titleField.optional(),
    body: bodyField.optional(),
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
