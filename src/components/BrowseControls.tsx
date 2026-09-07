import Link from "next/link";
import { SortSelect } from "@/components/SortSelect";
import {
  SORT_OPTIONS,
  queryHref,
  type SortKey,
  type StorefrontQuery,
} from "@/lib/storefront-query";
import { LAYOUTS, type LayoutId } from "@/lib/theme";

/**
 * Sort and layout controls.
 *
 * Both are links (or, for sort, a select that navigates to one), so the
 * customer's choice ends up in the URL alongside their filters and survives
 * being shared or reopened. The layout choice starts at whatever the shop set
 * as its default and only appears in the URL once someone changes it.
 */
export function BrowseControls({
  basePath,
  query,
  defaultLayout,
}: {
  basePath: string;
  query: StorefrontQuery;
  defaultLayout: LayoutId;
}) {
  const sortOptions = (Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => ({
    value: key,
    label: SORT_OPTIONS[key].label,
    href: queryHref(basePath, query, defaultLayout, { sort: key }),
  }));

  return (
    <div className="flex items-center gap-2">
      <SortSelect options={sortOptions} value={query.sort} />

      <div
        role="group"
        aria-label="Layout"
        className="flex shrink-0 rounded-md border border-st-border bg-st-surface p-0.5"
      >
        {LAYOUTS.map((layout) => {
          const active = query.layout === layout.id;
          return (
            <Link
              key={layout.id}
              href={queryHref(basePath, query, defaultLayout, { layout: layout.id })}
              aria-label={layout.label}
              aria-current={active ? "true" : undefined}
              title={layout.label}
              className={`flex h-8 w-8 items-center justify-center rounded transition ${
                active
                  ? "bg-st-accent text-st-accent-fg"
                  : "text-st-muted hover:bg-st-surface-2"
              }`}
            >
              <LayoutIcon layout={layout.id} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function LayoutIcon({ layout }: { layout: LayoutId }) {
  if (layout === "list") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-current">
        <rect x="2" y="3" width="4" height="4" rx="1" />
        <rect x="7.5" y="4" width="6.5" height="1.2" rx="0.6" />
        <rect x="2" y="9" width="4" height="4" rx="1" />
        <rect x="7.5" y="10" width="6.5" height="1.2" rx="0.6" />
      </svg>
    );
  }
  if (layout === "coverflow") {
    return (
      <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-current">
        <rect x="1" y="5" width="2.5" height="6" rx="0.6" opacity="0.45" />
        <rect x="4.4" y="3.8" width="3.2" height="8.4" rx="0.7" opacity="0.7" />
        <rect x="8.4" y="3" width="3.2" height="10" rx="0.8" />
        <rect x="12.5" y="5" width="2.5" height="6" rx="0.6" opacity="0.45" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-current">
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}
