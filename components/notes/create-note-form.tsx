"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NoteForm, type NoteFormResult } from "@/components/notes/note-form";
import { isClientErrorBody } from "@/lib/api/client-error";

export function CreateNoteForm(): React.JSX.Element {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  async function handleCreate({ title, body }: { title: string; body: string }): Promise<NoteFormResult> {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body }),
    });

    if (res.ok) {
      setIsOpen(false);
      router.refresh();
      return { ok: true };
    }

    const errorBody: unknown = await res.json();
    return { ok: false, ...(isClientErrorBody(errorBody) ? errorBody : {}) };
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        New note
      </button>
    );
  }

  return (
    <NoteForm
      formId="create-note"
      submitLabel="Create note"
      pendingLabel="Creating…"
      onCancel={() => setIsOpen(false)}
      onSubmit={handleCreate}
    />
  );
}
