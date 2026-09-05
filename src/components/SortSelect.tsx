"use client";

const SORT_LABELS: Record<string, string> = {
  newest: "Recently listed",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  title_asc: "Title: A–Z",
};

export function SortSelect({ slug, q, sort }: { slug: string; q: string; sort: string }) {
  return (
    <form action={`/store/${slug}`} method="GET" className="flex items-center gap-2 text-sm">
      {q && <input type="hidden" name="q" value={q} />}
      <label htmlFor="sort" className="text-neutral-500">
        Sort by
      </label>
      <select
        id="sort"
        name="sort"
        defaultValue={sort}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
      >
        {Object.entries(SORT_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );
}
