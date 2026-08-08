"use client";

import { useState } from "react";
import { isClientErrorBody } from "@/lib/api/client-error";
import type { Tag } from "@/lib/generated/prisma/client";

type TagSelectProps = {
  formId: string;
  initialTags: Tag[];
  initialSelectedTagIds?: string[];
  disabled?: boolean;
};

// Native checkboxes, not a custom combobox — each one is independently
// labeled and keyboard-operable with no extra ARIA pattern needed. Renders
// inside NoteForm's <form>; on submit, formData.getAll("tagIds") reads
// whatever's actually checked, including tags created here mid-session.
export function TagSelect({
  formId,
  initialTags,
  initialSelectedTagIds = [],
  disabled,
}: TagSelectProps): React.JSX.Element {
  const [tags, setTags] = useState(initialTags);
  const [selectedIds] = useState(() => new Set(initialSelectedTagIds));
  const [newTagName, setNewTagName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateTag(): Promise<void> {
    const name = newTagName.trim();
    if (!name) {
      return;
    }
    setIsCreating(true);
    setCreateError(null);

    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      const tag: Tag = await res.json();
      setTags((prev) => [...prev, tag]);
      selectedIds.add(tag.id);
      setNewTagName("");
    } else {
      const body: unknown = await res.json();
      setCreateError(isClientErrorBody(body) ? (body.error ?? "Couldn't create tag") : "Couldn't create tag");
    }
    setIsCreating(false);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Tags</legend>
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <li key={tag.id}>
              <label className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  name="tagIds"
                  value={tag.id}
                  defaultChecked={selectedIds.has(tag.id)}
                  disabled={disabled}
                />
                {tag.name}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-500">No tags yet.</p>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor={`${formId}-new-tag`} className="sr-only">
          New tag name
        </label>
        <input
          id={`${formId}-new-tag`}
          type="text"
          value={newTagName}
          onChange={(event) => setNewTagName(event.target.value)}
          disabled={disabled || isCreating}
          placeholder="New tag"
          className="rounded border border-zinc-300 px-2 py-1 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-zinc-100"
        />
        <button
          type="button"
          onClick={handleCreateTag}
          disabled={disabled || isCreating || newTagName.trim().length === 0}
          className="rounded border border-zinc-300 px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          {isCreating ? "Adding…" : "Add tag"}
        </button>
      </div>
      {createError ? (
        <p aria-live="polite" className="text-sm text-red-600 dark:text-red-400">
          {createError}
        </p>
      ) : null}
    </fieldset>
  );
}
