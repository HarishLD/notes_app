// Shared by every filter control (sort, search, tag filter) so each one
// updates its own query param without clobbering the others — state lives
// entirely in the URL, per CLAUDE.md §7, so it survives a refresh and is
// shareable.
export function withUpdatedParam(current: URLSearchParams, key: string, value: string | null): string {
  const next = new URLSearchParams(current);
  if (value === null || value === "") {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  return next.toString();
}
