"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { withUpdatedParam } from "@/components/notes/url-params";
import { useNotesTransition } from "@/components/notes/notes-transition-context";

export function SearchInput(): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { startTransition } = useNotesTransition();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const qs = withUpdatedParam(searchParams, "q", value.trim() || null);
    // The input itself stays enabled throughout — only the navigation this
    // triggers is deferred, so keystrokes typed during the round-trip are
    // never dropped.
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex items-center gap-2">
      <label htmlFor="notes-search" className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        Search
      </label>
      <input
        id="notes-search"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by title"
        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-900 hover:border-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:border-zinc-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
      />
      <button
        type="submit"
        className="rounded-lg border border-zinc-300 px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Search
      </button>
    </form>
  );
}
