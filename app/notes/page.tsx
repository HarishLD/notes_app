import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/errors";
import { listNotes } from "@/lib/notes/service";
import { listTags } from "@/lib/tags/service";
import { noteQuerySchema } from "@/lib/validation/note";
import { NoteList } from "@/components/notes/note-list";
import { NoteListRegion } from "@/components/notes/note-list-region";
import { NotesTransitionProvider } from "@/components/notes/notes-transition-context";
import { CreateNoteForm } from "@/components/notes/create-note-form";
import { SortSelect } from "@/components/notes/sort-select";
import { SearchInput } from "@/components/notes/search-input";
import { TagFilter } from "@/components/tags/tag-filter";
import type { SessionUser } from "@/lib/auth/service";

export const metadata: Metadata = {
  title: "Notes",
};

// proxy.ts's redirect is an optimistic, cookie-presence-only check (CLAUDE.md
// §6) — a forged or expired cookie can still reach this page. requireUser()
// is the authoritative check; when it rejects, send the visitor back to
// /login instead of letting the error surface as a generic error.tsx page.
async function requireUserOrRedirect(): Promise<SessionUser> {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    throw err;
  }
}

export default async function NotesPage({ searchParams }: PageProps<"/notes">): Promise<React.JSX.Element> {
  const user = await requireUserOrRedirect();

  // A hand-edited URL with a malformed sort/q shouldn't crash the page the
  // way a malformed API request should 400 — fall back to the defaults
  // instead of throwing into error.tsx.
  const rawParams = await searchParams;
  const parsedQuery = noteQuerySchema.safeParse(rawParams);
  const query = parsedQuery.success
    ? parsedQuery.data
    : { sort: "newest" as const, tags: undefined, q: undefined };

  const [notes, tags] = await Promise.all([
    listNotes(user.id, { sort: query.sort, q: query.q, tagIds: query.tags }),
    listTags(user.id),
  ]);

  const hasActiveFilters = Boolean(query.tags && query.tags.length > 0) || Boolean(query.q);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      {/* Solid panel, not the gradient canvas — every piece of text below
          needs an opaque surface under it. */}
      <div className="flex flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Notes</h1>
        <NotesTransitionProvider>
          <div className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-4">
              <SearchInput />
              <SortSelect />
            </div>
            <TagFilter tags={tags} />
          </div>
          <CreateNoteForm availableTags={tags} />
          <NoteListRegion>
            <NoteList notes={notes} availableTags={tags} hasActiveFilters={hasActiveFilters} />
          </NoteListRegion>
        </NotesTransitionProvider>
      </div>
    </main>
  );
}
