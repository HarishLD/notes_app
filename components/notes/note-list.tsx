import { NoteCard } from "@/components/notes/note-card";
import type { NoteWithTags } from "@/lib/notes/service";
import type { Tag } from "@/lib/generated/prisma/client";

type NoteListProps = {
  notes: NoteWithTags[];
  availableTags: Tag[];
  // Distinguishes "no notes exist" from "no notes match the current
  // filter/search" — the two need different empty-state copy.
  hasActiveFilters: boolean;
};

export function NoteList({ notes, availableTags, hasActiveFilters }: NoteListProps): React.JSX.Element {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {hasActiveFilters
          ? "No notes match your filters."
          : "You have no notes yet. Create one to get started."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} availableTags={availableTags} />
      ))}
    </ul>
  );
}
