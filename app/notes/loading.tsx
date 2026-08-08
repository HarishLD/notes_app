export default function NotesLoading(): React.JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10" aria-busy="true" aria-live="polite">
      {/* Same panel shape as the loaded page, so there's no layout jump
          when the real content replaces this. */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading notes…</p>
      </div>
    </main>
  );
}
