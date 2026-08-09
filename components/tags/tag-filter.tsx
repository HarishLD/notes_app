"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { withUpdatedParam } from "@/components/notes/url-params";
import { useNotesTransition } from "@/components/notes/notes-transition-context";
import type { Tag } from "@/lib/generated/prisma/client";

type TagFilterProps = {
  tags: Tag[];
};

// Controlled checkboxes, not uncontrolled like TagSelect's — there's no
// form submit here, the URL is the source of truth, and each toggle
// immediately reflects it (checked derived straight from searchParams).
export function TagFilter({ tags }: TagFilterProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startTransition } = useNotesTransition();
  const selectedIds = new Set((searchParams.get("tags") ?? "").split(",").filter(Boolean));

  function handleToggle(tagId: string, checked: boolean): void {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(tagId);
    } else {
      next.delete(tagId);
    }
    const qs = withUpdatedParam(searchParams, "tags", next.size > 0 ? Array.from(next).join(",") : null);
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Filter by tag</legend>
      {tags.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <li key={tag.id}>
              <label className="flex items-center gap-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={selectedIds.has(tag.id)}
                  onChange={(event) => handleToggle(tag.id, event.target.checked)}
                  className="accent-indigo-600"
                />
                {tag.name}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No tags yet.</p>
      )}
    </fieldset>
  );
}
