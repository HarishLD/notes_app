"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NoteForm, type NoteFormResult } from "@/components/notes/note-form";
import { TagChip } from "@/components/tags/tag-chip";
import { isClientErrorBody } from "@/lib/api/client-error";
import type { NoteWithTags } from "@/lib/notes/service";
import type { Tag } from "@/lib/generated/prisma/client";

type NoteCardProps = {
  note: NoteWithTags;
  availableTags: Tag[];
};

function excerpt(body: string, maxLength = 160): string {
  if (body.length <= maxLength) {
    return body;
  }
  return `${body.slice(0, maxLength).trimEnd()}…`;
}

export function NoteCard({ note, availableTags }: NoteCardProps): React.JSX.Element {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleEdit({
    title,
    body,
    tagIds,
  }: {
    title: string;
    body: string;
    tagIds: string[];
  }): Promise<NoteFormResult> {
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, body, tagIds }),
    });

    if (res.ok) {
      setIsEditing(false);
      router.refresh();
      return { ok: true };
    }

    const errorBody: unknown = await res.json();
    return { ok: false, ...(isClientErrorBody(errorBody) ? errorBody : {}) };
  }

  async function handleDelete(): Promise<void> {
    setIsDeleting(true);
    setDeleteError(null);

    const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });

    if (res.ok) {
      router.refresh();
      return;
    }

    const body: unknown = await res.json();
    setDeleteError(isClientErrorBody(body) ? (body.error ?? "Something went wrong") : "Something went wrong");
    setIsDeleting(false);
    setIsConfirmingDelete(false);
  }

  if (isEditing) {
    return (
      <li className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <NoteForm
          formId={`edit-note-${note.id}`}
          initialTitle={note.title}
          initialBody={note.body}
          initialTagIds={note.tags.map((tag) => tag.id)}
          availableTags={availableTags}
          submitLabel="Save"
          pendingLabel="Saving…"
          onCancel={() => setIsEditing(false)}
          onSubmit={handleEdit}
        />
      </li>
    );
  }

  return (
    <li className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{note.title}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{excerpt(note.body)}</p>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
        {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(note.createdAt))}
      </p>
      {note.tags.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <li key={tag.id}>
              <TagChip name={tag.name} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Edit
        </button>
        {isConfirmingDelete ? (
          <>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">Delete this note?</p>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-busy={isDeleting}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(false)}
              disabled={isDeleting}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirmingDelete(true)}
            className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Delete
          </button>
        )}
      </div>
      {deleteError ? (
        <p aria-live="polite" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {deleteError}
        </p>
      ) : null}
    </li>
  );
}
