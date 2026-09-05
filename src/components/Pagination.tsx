import Link from "next/link";

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(target: number) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  }

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav className="flex items-center justify-center gap-4 pt-4">
      {prevDisabled ? (
        <span className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-300">
          Previous
        </span>
      ) : (
        <Link
          href={hrefFor(page - 1)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100"
        >
          Previous
        </Link>
      )}
      <span className="text-sm text-neutral-600">
        Page {page} of {totalPages}
      </span>
      {nextDisabled ? (
        <span className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-300">
          Next
        </span>
      ) : (
        <Link
          href={hrefFor(page + 1)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-100"
        >
          Next
        </Link>
      )}
    </nav>
  );
}
