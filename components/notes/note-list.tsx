import { NoteCard } from "@/components/notes/note-card";
import type { NoteWithTags } from "@/lib/notes/service";

type NoteListProps = {
  notes: NoteWithTags[];
};

export function NoteList({ notes }: NoteListProps): React.JSX.Element {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">You have no notes yet. Create one to get started.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </ul>
  );
}
