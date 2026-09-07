import Link from "next/link";

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
  hrefFor,
  themed,
}: {
  basePath?: string;
  params?: Record<string, string | undefined>;
  page: number;
  totalPages: number;
  /**
   * Builds a page link. The storefront passes this because its URL carries
   * filters, sort and layout that a plain key/value map would flatten badly.
   */
  hrefFor?: (page: number) => string;
  themed?: boolean;
}) {
  if (totalPages <= 1) return null;

  const href =
    hrefFor ??
    ((target: number) => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params ?? {})) {
        if (value) search.set(key, value);
      }
      search.set("page", String(target));
      return `${basePath ?? ""}?${search.toString()}`;
    });

  const link = themed
    ? "rounded-md border border-st-border bg-st-surface px-3 py-1.5 text-sm text-st-fg transition hover:bg-st-surface-2"
    : "rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100";
  const disabled = themed
    ? "rounded-md border border-st-border px-3 py-1.5 text-sm text-st-faint opacity-50"
    : "rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-300";
  const label = themed ? "text-sm text-st-muted" : "text-sm text-neutral-600";

  return (
    <nav className="flex items-center justify-center gap-4 pt-4">
      {page <= 1 ? (
        <span className={disabled}>Previous</span>
      ) : (
        <Link href={href(page - 1)} className={link}>
          Previous
        </Link>
      )}
      <span className={label}>
        Page {page} of {totalPages}
      </span>
      {page >= totalPages ? (
        <span className={disabled}>Next</span>
      ) : (
        <Link href={href(page + 1)} className={link}>
          Next
        </Link>
      )}
    </nav>
  );
}
