"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";

type NotesTransitionContextValue = {
  isPending: boolean;
  startTransition: (callback: () => void) => void;
};

const NotesTransitionContext = createContext<NotesTransitionContextValue | null>(null);

// One shared transition for the whole toolbar — search, sort, and the tag
// filter each push a different query param, but they should all report
// into the same pending state so a region watching for it (NoteListRegion)
// only has one flag to read, not one per control.
export function NotesTransitionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  return (
    <NotesTransitionContext.Provider value={{ isPending, startTransition }}>
      {children}
    </NotesTransitionContext.Provider>
  );
}

export function useNotesTransition(): NotesTransitionContextValue {
  const ctx = useContext(NotesTransitionContext);
  if (!ctx) {
    throw new Error("useNotesTransition must be used within a NotesTransitionProvider");
  }
  return ctx;
}
