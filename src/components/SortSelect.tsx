"use client";

import { useRouter } from "next/navigation";

/**
 * Sort control.
 *
 * Each option carries the URL it leads to, built on the server from the current
 * filters, so choosing a sort can never drop the rest of the query. Rendered as
 * a real select because a phone gets the native picker, and it degrades to a
 * no-op rather than a broken control if the JavaScript hasn't arrived.
 */
export function SortSelect({
  options,
  value,
}: {
  options: { value: string; label: string; href: string }[];
  value: string;
}) {
  const router = useRouter();

  return (
    <label className="flex min-w-0 items-center gap-2 text-sm">
      <span className="sr-only">Sort by</span>
      <select
        value={value}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) router.push(next.href);
        }}
        className="min-w-0 rounded-md border border-st-border bg-st-surface px-2 py-1.5 text-sm text-st-fg"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
