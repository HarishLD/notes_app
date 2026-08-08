type FormFieldProps = {
  id: string;
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  disabled?: boolean;
  errors?: string[];
  inputRef?: React.Ref<HTMLInputElement>;
};

export function FormField({
  id,
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  disabled,
  errors,
  inputRef,
}: FormFieldProps): React.JSX.Element {
  const errorId = `${id}-error`;
  const errorMessage = errors && errors.length > 0 ? errors.join(" ") : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
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
