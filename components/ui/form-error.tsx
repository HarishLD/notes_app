type FormErrorProps = {
  message: string | null;
};

// Always rendered, never conditionally mounted — an aria-live region only
// reliably announces changes to assistive tech if it already exists in the
// DOM before its content changes.
export function FormError({ message }: FormErrorProps): React.JSX.Element {
  return (
    <p aria-live="polite" className="min-h-5 text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}
