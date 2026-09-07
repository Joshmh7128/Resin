import type { Prisma } from "@prisma/client";
import { isLayoutId, type LayoutId } from "@/lib/theme";

/**
 * The customer-facing browse state: search, filters, sorting, layout, page.
 *
 * All of it lives in the query string rather than in component state. A shop's
 * page gets shared, bookmarked and reopened from a QR code, so a filtered view
 * has to survive being pasted into a message, and it means the results are
 * rendered on the server with no hydration wait on a phone.
 */

export const SORT_OPTIONS = {
  // Ordered by when we first saw the listing, not `updatedAt`. Caching an
  // item's cover art counts as an update, so ordering by `updatedAt` made the
  // grid reshuffle under the customer as artwork loaded in.
  newest: { label: "Recently listed", orderBy: { createdAt: "desc" } },
  oldest: { label: "Longest in stock", orderBy: { createdAt: "asc" } },
  // Prices are optional on Discogs listings. Postgres sorts nulls first on a
  // descending sort, which would open "highest price" with the priceless ones.
  price_asc: { label: "Price: low to high", orderBy: { price: { sort: "asc", nulls: "last" } } },
  price_desc: { label: "Price: high to low", orderBy: { price: { sort: "desc", nulls: "last" } } },
  artist_asc: { label: "Artist: A to Z", orderBy: { artist: "asc" } },
  title_asc: { label: "Title: A to Z", orderBy: { title: "asc" } },
  year_desc: { label: "Year: newest first", orderBy: { year: { sort: "desc", nulls: "last" } } },
  year_asc: { label: "Year: oldest first", orderBy: { year: { sort: "asc", nulls: "last" } } },
} as const satisfies Record<
  string,
  { label: string; orderBy: Prisma.InventoryItemOrderByWithRelationInput }
>;

export type SortKey = keyof typeof SORT_OPTIONS;

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && value in SORT_OPTIONS;
}

/** Query-string keys. Kept short so a filtered link stays readable. */
export const PARAM = {
  q: "q",
  page: "page",
  sort: "sort",
  layout: "view",
  genre: "genre",
  style: "style",
  format: "format",
  decade: "decade",
  condition: "cond",
  label: "label",
  country: "country",
  priceMin: "pmin",
  priceMax: "pmax",
  featured: "feat",
} as const;

/** The multi-select facets, in the order they are shown to customers. */
export const FACET_KEYS = [
  "genre",
  "style",
  "format",
  "decade",
  "condition",
  "label",
  "country",
] as const;

export type FacetKey = (typeof FACET_KEYS)[number];

export const FACET_LABELS: Record<FacetKey, string> = {
  genre: "Genre",
  style: "Style",
  format: "Format",
  decade: "Decade",
  condition: "Condition",
  label: "Label",
  country: "Pressing country",
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface StorefrontQuery {
  q: string;
  page: number;
  sort: SortKey;
  layout: LayoutId;
  facets: Record<FacetKey, string[]>;
  priceMin: number | null;
  priceMax: number | null;
  featuredOnly: boolean;
}

function readParam(params: RawSearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Reads a multi-value facet parameter.
 *
 * Accepts both shapes it can arrive in: our own links join values with commas
 * to keep a shared URL short, while the filter form is a plain GET form whose
 * checkboxes repeat the key. Values are capped in count and length so a
 * hand-built URL can't turn one page view into an enormous query.
 */
function readList(params: RawSearchParams, key: string): string[] {
  const raw = params[key];
  if (!raw) return [];
  const parts = (Array.isArray(raw) ? raw : [raw]).flatMap((entry) => entry.split(","));

  const seen = new Set<string>();
  for (const part of parts) {
    const value = part.trim();
    if (value && value.length <= 80) seen.add(value);
    if (seen.size >= 25) break;
  }
  return [...seen];
}

function readNumber(params: RawSearchParams, key: string): number | null {
  const raw = readParam(params, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseStorefrontQuery(
  params: RawSearchParams,
  defaultLayout: LayoutId,
): StorefrontQuery {
  const layoutParam = readParam(params, PARAM.layout);
  const sortParam = readParam(params, PARAM.sort);

  return {
    q: readParam(params, PARAM.q),
    page: Math.max(1, parseInt(readParam(params, PARAM.page) || "1", 10) || 1),
    sort: isSortKey(sortParam) ? sortParam : "newest",
    layout: isLayoutId(layoutParam) ? layoutParam : defaultLayout,
    facets: {
      genre: readList(params, PARAM.genre),
      style: readList(params, PARAM.style),
      format: readList(params, PARAM.format),
      decade: readList(params, PARAM.decade),
      condition: readList(params, PARAM.condition),
      label: readList(params, PARAM.label),
      country: readList(params, PARAM.country),
    },
    priceMin: readNumber(params, PARAM.priceMin),
    priceMax: readNumber(params, PARAM.priceMax),
    featuredOnly: readParam(params, PARAM.featured) === "1",
  };
}

export function hasActiveFilters(query: StorefrontQuery): boolean {
  return (
    FACET_KEYS.some((key) => query.facets[key].length > 0) ||
    query.priceMin !== null ||
    query.priceMax !== null ||
    query.featuredOnly
  );
}

export function activeFilterCount(query: StorefrontQuery): number {
  let count = FACET_KEYS.reduce((sum, key) => sum + query.facets[key].length, 0);
  if (query.priceMin !== null || query.priceMax !== null) count += 1;
  if (query.featuredOnly) count += 1;
  return count;
}

/**
 * Genres and styles are stored as a JSON array string on the item, so a match
 * has to be against the quoted element rather than a bare substring. Without
 * the quotes, filtering on "Techno" would also return every "Tech House"
 * record, and "Rock" would sweep in "Rockabilly".
 */
function jsonArrayContains(values: string[], field: "genres" | "styles" | "formatDescriptions") {
  return {
    OR: values.map((value) => ({
      [field]: { contains: `"${escapeJsonString(value)}"` },
    })),
  } as Prisma.InventoryItemWhereInput;
}

/** Matches how the values were written with JSON.stringify, so the compare lines up. */
function escapeJsonString(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

function decadeRanges(values: string[]): Prisma.InventoryItemWhereInput | null {
  const ranges = values
    .map((value) => parseInt(value, 10))
    .filter((year) => Number.isFinite(year) && year >= 1900 && year <= 2100)
    .map((start) => ({ year: { gte: start, lte: start + 9 } }));
  return ranges.length > 0 ? { OR: ranges } : null;
}

/**
 * Turns the parsed query into a Prisma filter.
 *
 * Values within one facet are OR'd (a record in Rock *or* Jazz) and the facets
 * are AND'd together, which is what people expect from faceted browsing:
 * ticking a second genre widens the results, ticking a second facet narrows
 * them.
 */
export function buildWhere(storeId: string, query: StorefrontQuery): Prisma.InventoryItemWhereInput {
  const and: Prisma.InventoryItemWhereInput[] = [];

  if (query.q) and.push({ searchText: { contains: query.q.toLowerCase() } });
  if (query.featuredOnly) and.push({ isFeatured: true });

  if (query.facets.genre.length) and.push(jsonArrayContains(query.facets.genre, "genres"));
  if (query.facets.style.length) and.push(jsonArrayContains(query.facets.style, "styles"));
  if (query.facets.format.length) {
    and.push(jsonArrayContains(query.facets.format, "formatDescriptions"));
  }
  if (query.facets.condition.length) and.push({ condition: { in: query.facets.condition } });
  if (query.facets.label.length) and.push({ label: { in: query.facets.label } });
  if (query.facets.country.length) and.push({ country: { in: query.facets.country } });

  const decades = decadeRanges(query.facets.decade);
  if (decades) and.push(decades);

  if (query.priceMin !== null) and.push({ price: { gte: query.priceMin } });
  if (query.priceMax !== null) and.push({ price: { lte: query.priceMax } });

  return {
    storeId,
    isVisible: true,
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Links                                                                      */
/* -------------------------------------------------------------------------- */

/** The query as URL parameters, dropping anything left at its default. */
export function toSearchParams(query: StorefrontQuery, defaultLayout: LayoutId): URLSearchParams {
  const search = new URLSearchParams();
  if (query.q) search.set(PARAM.q, query.q);
  if (query.sort !== "newest") search.set(PARAM.sort, query.sort);
  if (query.layout !== defaultLayout) search.set(PARAM.layout, query.layout);
  for (const key of FACET_KEYS) {
    const values = query.facets[key];
    if (values.length > 0) search.set(PARAM[key], values.join(","));
  }
  if (query.priceMin !== null) search.set(PARAM.priceMin, String(query.priceMin));
  if (query.priceMax !== null) search.set(PARAM.priceMax, String(query.priceMax));
  if (query.featuredOnly) search.set(PARAM.featured, "1");
  return search;
}

function href(basePath: string, search: URLSearchParams): string {
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** A link to the same view with one thing changed. Always returns to page 1. */
export function queryHref(
  basePath: string,
  query: StorefrontQuery,
  defaultLayout: LayoutId,
  patch: Partial<Omit<StorefrontQuery, "facets">> & { facets?: Partial<Record<FacetKey, string[]>> },
): string {
  const next: StorefrontQuery = {
    ...query,
    ...patch,
    page: 1,
    facets: { ...query.facets, ...(patch.facets ?? {}) },
  };
  return href(basePath, toSearchParams(next, defaultLayout));
}

/** Adds a facet value if it isn't selected, removes it if it is. */
export function toggleFacetHref(
  basePath: string,
  query: StorefrontQuery,
  defaultLayout: LayoutId,
  key: FacetKey,
  value: string,
): string {
  const current = query.facets[key];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  return queryHref(basePath, query, defaultLayout, { facets: { [key]: next } });
}

/** Clears every filter but keeps the search term, sort and layout. */
export function clearFiltersHref(
  basePath: string,
  query: StorefrontQuery,
  defaultLayout: LayoutId,
): string {
  const cleared: Partial<Record<FacetKey, string[]>> = {};
  for (const key of FACET_KEYS) cleared[key] = [];

  return queryHref(basePath, query, defaultLayout, {
    facets: cleared,
    priceMin: null,
    priceMax: null,
    featuredOnly: false,
  });
}

export function pageHref(
  basePath: string,
  query: StorefrontQuery,
  defaultLayout: LayoutId,
  page: number,
): string {
  const search = toSearchParams(query, defaultLayout);
  if (page > 1) search.set(PARAM.page, String(page));
  return href(basePath, search);
}
