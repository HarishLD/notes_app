export default function NotesLoading(): React.JSX.Element {
  return (
    <main
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading notes…</p>
    </main>
  );
}
