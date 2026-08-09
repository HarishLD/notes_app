type TagChipProps = {
  name: string;
};

// Background/text pairs are decorative only — the tag name is still the
// thing that identifies the tag, so nothing depends on colour alone. Each
// pair is verified at 4.5:1+ contrast in both light and dark mode (see
// DECISIONS.md). Indigo is excluded — that's reserved for interactive
// elements, and reusing it here would make chips read as clickable.
const PALETTE = [
  "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  "bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900 dark:text-fuchsia-300",
] as const;

// djb2 — a stable string hash, so the same tag name always lands on the
// same palette entry, on every render and everywhere a chip appears.
// Math.random() would repaint the same tag a different colour each time.
function hashTagName(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 33) ^ name.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function TagChip({ name }: TagChipProps): React.JSX.Element {
  const colour = PALETTE[hashTagName(name) % PALETTE.length];
  return <span className={`rounded-lg px-2 py-0.5 text-xs ${colour}`}>{name}</span>;
}
