import type { Metadata } from "next";
import { NoteIcon } from "@/components/ui/note-icon";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in — Notes",
};

export default function LoginPage(): React.JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      {/* Solid card, not the gradient canvas — every piece of text below
          needs an opaque surface under it. */}
      <div className="rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <NoteIcon className="mx-auto h-8 w-8 text-indigo-600 dark:text-indigo-400" />
        <h1 className="mt-4 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Log in</h1>
        <p className="mt-1 mb-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to see your notes.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
