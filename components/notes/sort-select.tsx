"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChangeEvent } from "react";
import { withUpdatedParam } from "@/components/notes/url-params";
import { useNotesTransition } from "@/components/notes/notes-transition-context";

export function SortSelect(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startTransition } = useNotesTransition();
  const currentSort = searchParams.get("sort") === "oldest" ? "oldest" : "newest";

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    // "newest" is the default — omit it from the URL so an unfiltered view
    // has a clean address instead of always carrying ?sort=newest.
    const qs = withUpdatedParam(searchParams, "sort", event.target.value === "newest" ? null : event.target.value);
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="notes-sort" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Sort
      </label>
      <select
        id="notes-sort"
        value={currentSort}
        onChange={handleChange}
        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-900 hover:border-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:border-zinc-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </div>
  );
}
