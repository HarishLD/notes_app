type FormTextareaProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  disabled?: boolean;
  errors?: string[];
};

export function FormTextarea({
  id,
  name,
  label,
  defaultValue,
  rows = 4,
  disabled,
  errors,
}: FormTextareaProps): React.JSX.Element {
  const errorId = `${id}-error`;
  const errorMessage = errors && errors.length > 0 ? errors.join(" ") : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        disabled={disabled}
        aria-invalid={errorMessage !== undefined || undefined}
        aria-describedby={errorMessage !== undefined ? errorId : undefined}
        className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:ring-zinc-100"
      />
      {errorMessage !== undefined ? (
        <p id={errorId} className="text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
