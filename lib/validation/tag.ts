import { z } from "zod";

export const createTagSchema = z.object({
  // Custom messages replace zod's defaults, same reasoning as note.ts.
  name: z.string().trim().toLowerCase().min(1, "Tag name is required.").max(40, "Tag name must be 40 characters or fewer."),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;
