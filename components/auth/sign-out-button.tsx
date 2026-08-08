"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton(): React.JSX.Element {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleSignOut(): Promise<void> {
    setIsPending(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // A network failure here shouldn't trap the user in the app — still
      // navigate away. requireUser() remains the authoritative gate either way.
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      aria-busy={isPending}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
