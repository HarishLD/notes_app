"use client";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Catches anything unexpected outside the /notes segment (which has its
// own, more specific error.tsx) — e.g. a rendering failure on / or the
// auth pages. The thrown error's detail never reaches this UI — CLAUDE.md
// §4.5 — and there's nothing to log: console.error is reserved for the one
// unhandled branch in lib/api/handler.ts, and a Server Component failure
// is already visible in server logs.
export default function RootError({ reset }: RootErrorProps): React.JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Something went wrong</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Please try again.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Try again
      </button>
    </main>
  );
}
