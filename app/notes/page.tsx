import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/errors";
import { listNotes } from "@/lib/notes/service";
import { listTags } from "@/lib/tags/service";
import { NoteList } from "@/components/notes/note-list";
import { CreateNoteForm } from "@/components/notes/create-note-form";
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

export default async function NotesPage(): Promise<React.JSX.Element> {
  const user = await requireUserOrRedirect();
  const [notes, tags] = await Promise.all([listNotes(user.id, { sort: "newest" }), listTags(user.id)]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Notes</h1>
      <CreateNoteForm availableTags={tags} />
      <NoteList notes={notes} availableTags={tags} />
    </main>
  );
}
