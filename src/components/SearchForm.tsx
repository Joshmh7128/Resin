export function SearchForm({
  action,
  defaultValue,
  placeholder = "Search title, artist, catalog #…",
  hidden,
  themed,
}: {
  action: string;
  defaultValue?: string;
  placeholder?: string;
  /**
   * Extra parameters to carry through the search. A search is a GET form, so
   * anything not resubmitted here is dropped: without this, searching would
   * silently clear the customer's filters and chosen layout.
   */
  hidden?: Record<string, string | undefined>;
  /** Use the storefront's theme colours rather than the dashboard's. */
  themed?: boolean;
}) {
  const input = themed
    ? "w-full max-w-md rounded-md border border-st-border bg-st-surface px-3 py-2 text-sm text-st-fg placeholder:text-st-faint focus:border-st-accent focus:outline-none"
    : "w-full max-w-md rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

  const button = themed
    ? "shrink-0 rounded-md bg-st-accent px-4 py-2 text-sm font-semibold text-st-accent-fg"
    : "rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700";

  return (
    <form action={action} method="GET" className="flex w-full gap-2">
      {Object.entries(hidden ?? {}).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={input}
      />
      <button type="submit" className={button}>
        Search
      </button>
    </form>
  );
}
