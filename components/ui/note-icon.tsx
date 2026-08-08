type NoteIconProps = {
  className?: string;
};

// Purely decorative — aria-hidden, no information it conveys isn't already
// in the heading text next to it. Inline rather than a dependency: it's
// the one icon this app uses.
export function NoteIcon({ className }: NoteIconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}
