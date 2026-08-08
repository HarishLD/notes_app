"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormError } from "@/components/ui/form-error";

export type NoteFormResult = { ok: true } | { ok: false; fields?: Record<string, string[]>; error?: string };

type NoteFormProps = {
  // Namespaces field ids — more than one NoteForm (the create form, an
  // in-progress edit) can exist in the DOM at once.
  formId: string;
  initialTitle?: string;
  initialBody?: string;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (data: { title: string; body: string }) => Promise<NoteFormResult>;
  onCancel?: () => void;
};

export function NoteForm({
  formId,
  initialTitle = "",
  initialBody = "",
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
}: NoteFormProps): React.JSX.Element {
  const [isPending, setIsPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsPending(true);
    setFieldErrors({});
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") ?? "");
    const body = String(formData.get("body") ?? "");

    const result = await onSubmit({ title, body });

    // On success the parent is responsible for hiding this form (closing
    // the create toggle, exiting edit mode) and calling router.refresh() —
    // this component only needs to stop showing its own pending state.
    if (!result.ok) {
      setFieldErrors(result.fields ?? {});
      setFormError(result.error ?? "Something went wrong");
    }
    setIsPending(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <FormField
        id={`${formId}-title`}
        name="title"
        label="Title"
        defaultValue={initialTitle}
        disabled={isPending}
        errors={fieldErrors.title}
      />
      <FormTextarea
        id={`${formId}-body`}
        name="body"
        label="Body"
        defaultValue={initialBody}
        disabled={isPending}
        errors={fieldErrors.body}
      />
      <FormError message={formError} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
