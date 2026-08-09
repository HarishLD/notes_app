"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormError } from "@/components/ui/form-error";
import { isClientErrorBody } from "@/lib/api/client-error";

export function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsPending(true);
    setFieldErrors({});
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/notes");
        router.refresh();
        return;
      }

      const body: unknown = await res.json();
      if (isClientErrorBody(body)) {
        setFieldErrors(body.fields ?? {});
        setFormError(body.error ?? "Something went wrong. Please try again.");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } catch {
      setFormError("Something went wrong. Check your connection and try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormField
        id="login-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        disabled={isPending}
        errors={fieldErrors.email}
      />
      <FormField
        id="login-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        disabled={isPending}
        errors={fieldErrors.password}
      />
      <FormError message={formError} />
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-indigo-600 underline hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
