type TagChipProps = {
  name: string;
};

export function TagChip({ name }: TagChipProps): React.JSX.Element {
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {name}
    </span>
  );
}
