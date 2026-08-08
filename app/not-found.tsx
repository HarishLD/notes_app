import Link from "next/link";

export default function NotFound(): React.JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16">
      {/* Solid panel, not the gradient canvas — text needs an opaque
          surface under it. */}
      <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Page not found</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
