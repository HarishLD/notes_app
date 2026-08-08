"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NoteForm, type NoteFormResult } from "@/components/notes/note-form";
import { isClientErrorBody } from "@/lib/api/client-error";
import type { Tag } from "@/lib/generated/prisma/client";

type CreateNoteFormProps = {
  availableTags: Tag[];
};

export function CreateNoteForm({ availableTags }: CreateNoteFormProps): React.JSX.Element {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  async function handleCreate({
    title,
    body,
    tagIds,
  }: {
    title: string;
    body: string;
    tagIds: string[];
  }): Promise<NoteFormResult> {
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, body, tagIds }),
      });

      if (res.ok) {
        setIsOpen(false);
        router.refresh();
        return { ok: true };
      }

      const errorBody: unknown = await res.json();
      return { ok: false, ...(isClientErrorBody(errorBody) ? errorBody : {}) };
    } catch {
      return { ok: false, error: "Something went wrong. Check your connection and try again." };
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        New note
      </button>
    );
  }

  return (
    <NoteForm
      formId="create-note"
      availableTags={availableTags}
      submitLabel="Create note"
      pendingLabel="Creating…"
      onCancel={() => setIsOpen(false)}
      onSubmit={handleCreate}
    />
  );
}
