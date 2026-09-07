import Link from "next/link";
import type { StoreFacets } from "@/lib/facets";
import {
  FACET_KEYS,
  FACET_LABELS,
  PARAM,
  activeFilterCount,
  clearFiltersHref,
  hasActiveFilters,
  queryHref,
  toggleFacetHref,
  type FacetKey,
  type StorefrontQuery,
} from "@/lib/storefront-query";
import type { LayoutId } from "@/lib/theme";

/**
 * The filter drawer.
 *
 * It is a plain GET form inside a native details element, which is a deliberate
 * choice: no JavaScript has to load before a customer can filter, the result is
 * a real URL they can share or bookmark, and back works the way they expect.
 * Ticking boxes changes nothing until Apply, so a phone doesn't reload the page
 * under someone's thumb while they are still choosing.
 */
export function FilterPanel({
  basePath,
  query,
  facets,
  defaultLayout,
  currency,
}: {
  basePath: string;
  query: StorefrontQuery;
  facets: StoreFacets;
  defaultLayout: LayoutId;
  currency: string;
}) {
  const count = activeFilterCount(query);
  const groups = FACET_KEYS.filter((key) => facets[key].length > 1);
  const nothingToFilter = groups.length === 0 && facets.featuredCount === 0 && !facets.priceRange;

  if (nothingToFilter) return null;

  return (
    <details className="group/panel">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-full border border-st-border bg-st-surface px-3 py-1.5 text-sm font-medium text-st-fg transition hover:bg-st-surface-2 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4">
          <path
            d="M2 4h12M4.5 8h7M7 12h2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Filters
        {count > 0 && (
          <span className="rounded-full bg-st-accent px-1.5 py-0.5 text-xs font-semibold text-st-accent-fg">
            {count}
          </span>
        )}
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className="h-3 w-3 transition-transform group-open/panel:rotate-180"
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <form
        action={basePath}
        method="GET"
        className="mt-3 rounded-xl border border-st-border bg-st-surface p-3 sm:p-4"
      >
        {/* Carried through so filtering doesn't drop the search or the chosen
            view. `page` is deliberately absent: new filters mean page one. */}
        {query.q && <input type="hidden" name={PARAM.q} value={query.q} />}
        {query.sort !== "newest" && <input type="hidden" name={PARAM.sort} value={query.sort} />}
        {query.layout !== defaultLayout && (
          <input type="hidden" name={PARAM.layout} value={query.layout} />
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((key) => (
            <FacetGroup key={key} facetKey={key} query={query} values={facets[key]} />
          ))}

          {facets.priceRange && (
            <fieldset className="rounded-lg border border-st-border p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-st-faint">
                Price ({currency})
              </legend>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  name={PARAM.priceMin}
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={query.priceMin ?? ""}
                  placeholder={String(facets.priceRange.min)}
                  aria-label="Minimum price"
                  className="w-full rounded-md border border-st-border bg-st-surface px-2 py-1.5 text-sm text-st-fg"
                />
                <span className="text-sm text-st-faint">to</span>
                <input
                  type="number"
                  name={PARAM.priceMax}
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  defaultValue={query.priceMax ?? ""}
                  placeholder={String(facets.priceRange.max)}
                  aria-label="Maximum price"
                  className="w-full rounded-md border border-st-border bg-st-surface px-2 py-1.5 text-sm text-st-fg"
                />
              </div>

              {facets.featuredCount > 0 && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-st-fg">
                  <input
                    type="checkbox"
                    name={PARAM.featured}
                    value="1"
                    defaultChecked={query.featuredOnly}
                    className="h-4 w-4 accent-st-accent"
                  />
                  Featured picks only
                  <span className="text-xs text-st-faint">({facets.featuredCount})</span>
                </label>
              )}
            </fieldset>
          )}
        </div>

        {facets.pendingDetail > 0 && (
          <p className="mt-3 text-xs text-st-faint">
            Genre, style, label and pressing country come from Discogs release pages, which are
            still being fetched for {facets.pendingDetail.toLocaleString()} record
            {facets.pendingDetail === 1 ? "" : "s"}. These filters will get more complete on their
            own.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-full bg-st-accent px-4 py-2 text-sm font-semibold text-st-accent-fg"
          >
            Apply filters
          </button>
          {hasActiveFilters(query) && (
            <Link
              href={clearFiltersHref(basePath, query, defaultLayout)}
              className="rounded-full border border-st-border px-4 py-2 text-sm font-medium text-st-muted transition hover:bg-st-surface-2"
            >
              Clear all
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}

/** How many options a group shows before it gets its own scroll area. */
const SCROLL_AFTER = 8;

function FacetGroup({
  facetKey,
  query,
  values,
}: {
  facetKey: FacetKey;
  query: StorefrontQuery;
  values: { value: string; label: string; count: number }[];
}) {
  const selected = new Set(query.facets[facetKey]);

  return (
    <fieldset className="rounded-lg border border-st-border p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-st-faint">
        {FACET_LABELS[facetKey]}
      </legend>
      <div
        className={`mt-1 space-y-1.5 ${
          values.length > SCROLL_AFTER ? "max-h-52 overflow-y-auto pr-1" : ""
        }`}
      >
        {values.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 text-sm text-st-fg"
          >
            <input
              type="checkbox"
              name={PARAM[facetKey]}
              value={option.value}
              defaultChecked={selected.has(option.value)}
              className="h-4 w-4 shrink-0 accent-st-accent"
            />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <span className="shrink-0 text-xs text-st-faint">{option.count}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The filters currently in force, each one removable on its own. Without these
 * a customer four filters deep has to open the drawer to see what they picked.
 */
export function ActiveFilterChips({
  basePath,
  query,
  defaultLayout,
}: {
  basePath: string;
  query: StorefrontQuery;
  defaultLayout: LayoutId;
}) {
  if (!hasActiveFilters(query)) return null;

  const chips: { key: string; label: string; href: string }[] = [];

  for (const key of FACET_KEYS) {
    for (const value of query.facets[key]) {
      chips.push({
        key: `${key}:${value}`,
        label: key === "decade" ? `${value}s` : value,
        href: toggleFacetHref(basePath, query, defaultLayout, key, value),
      });
    }
  }

  if (query.priceMin !== null || query.priceMax !== null) {
    const from = query.priceMin !== null ? query.priceMin : "any";
    const to = query.priceMax !== null ? query.priceMax : "any";
    chips.push({
      key: "price",
      label: `Price ${from} to ${to}`,
      href: queryHref(basePath, query, defaultLayout, { priceMin: null, priceMax: null }),
    });
  }

  if (query.featuredOnly) {
    chips.push({
      key: "featured",
      label: "Featured only",
      href: queryHref(basePath, query, defaultLayout, { featuredOnly: false }),
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href}
          className="inline-flex items-center gap-1.5 rounded-full border border-st-border bg-st-surface-2 py-1 pl-3 pr-2 text-xs font-medium text-st-fg transition hover:bg-st-surface"
        >
          {chip.label}
          <span aria-hidden className="text-st-faint">
            ×
          </span>
          <span className="sr-only">Remove filter</span>
        </Link>
      ))}
      <Link
        href={clearFiltersHref(basePath, query, defaultLayout)}
        className="text-xs font-medium text-st-muted underline"
      >
        Clear all
      </Link>
    </div>
  );
}
