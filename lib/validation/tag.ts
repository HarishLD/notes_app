import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().trim().toLowerCase().min(1).max(40),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;
