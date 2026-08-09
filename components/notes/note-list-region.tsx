"use client";

import type { ReactNode } from "react";
import { useNotesTransition } from "@/components/notes/notes-transition-context";

type NoteListRegionProps = {
  children: ReactNode;
};

// Search/sort/tag-filter all push a new URL and re-render this region from
// the server — with no feedback, that round-trip can look like nothing
// happened. aria-busy marks the region for assistive tech; the spinner
// underneath is a purely decorative echo of the same state, not a second
// source of truth. No opacity dimming here on purpose: fading the list
// would also fade its text, and re-verifying every note-card colour pair
// against 4.5:1 at a reduced opacity isn't worth it for a transition
// that's normally sub-second.
export function NoteListRegion({ children }: NoteListRegionProps): React.JSX.Element {
  const { isPending } = useNotesTransition();

  return (
    <div aria-busy={isPending}>
      {isPending ? (
        <span
          aria-hidden="true"
          className="mb-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400"
        />
      ) : null}
      {children}
    </div>
  );
}
