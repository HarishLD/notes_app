"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormError } from "@/components/ui/form-error";
import { isClientErrorBody } from "@/lib/api/client-error";

export function SignupForm(): React.JSX.Element {
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
      const res = await fetch("/api/auth/signup", {
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
        setFormError(body.error ?? "Something went wrong");
      } else {
        setFormError("Something went wrong");
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
        id="signup-email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        disabled={isPending}
        errors={fieldErrors.email}
      />
      <FormField
        id="signup-password"
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        disabled={isPending}
        errors={fieldErrors.password}
      />
      <FormError message={formError} />
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Signing up…" : "Sign up"}
      </button>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-50">
          Log in
        </Link>
      </p>
    </form>
  );
}
