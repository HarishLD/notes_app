// The client-side counterpart to toErrorResponse()'s response shape
// (CLAUDE.md §5) — used by client components to read { error, fields }
// back out of a non-2xx JSON response, without assuming its shape.
export type ClientErrorBody = {
  error?: string;
  fields?: Record<string, string[]>;
};

export function isClientErrorBody(value: unknown): value is ClientErrorBody {
  return typeof value === "object" && value !== null;
}
