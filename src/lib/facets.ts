import { prisma } from "@/lib/prisma";
import { splitFormatString } from "@/lib/discogs";
import { DETAIL_VERSION } from "@/lib/item-image";
import type { FacetKey } from "@/lib/storefront-query";

/**
 * The filter options a shop's catalogue actually contains.
 *
 * A fixed list of genres would be useless: a soul-only shop shouldn't offer a
 * "Classical" filter that returns nothing. So the options are derived from the
 * shop's own records, with counts, and anything absent simply isn't offered.
 *
 * Genre, style, label and pressing country come from the release lookup, so
 * they fill in as the background artwork warm progresses. Format, year,
 * condition and price come straight off the listing and are there immediately.
 */

export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export type StoreFacets = Record<FacetKey, FacetValue[]> & {
  /** Lowest and highest listed price, for the price filter's placeholders. */
  priceRange: { min: number; max: number } | null;
  featuredCount: number;
  /** Items whose release hasn't been looked up yet, so their tags are missing. */
  pendingDetail: number;
};

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

class Counter {
  private counts = new Map<string, number>();

  add(value: string | null | undefined) {
    const key = value?.trim();
    if (!key) return;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  /** Most common first, then alphabetically so the order is stable run to run. */
  top(limit: number, label: (value: string) => string = (v) => v): FacetValue[] {
    return [...this.counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([value, count]) => ({ value, label: label(value), count }));
  }

  /** Ordered by the value itself, for things with a natural order like decades. */
  sortedBy(compare: (a: string, b: string) => number, label: (v: string) => string): FacetValue[] {
    return [...this.counts.entries()]
      .sort((a, b) => compare(a[0], b[0]))
      .map(([value, count]) => ({ value, label: label(value), count }));
  }
}

/**
 * Discogs grades sleeves and media on a fixed scale. Ordering the filter by
 * that scale rather than by how many records happen to be in each grade is what
 * a buyer expects, since they are usually looking for "this good or better".
 */
const CONDITION_ORDER = [
  "Mint (M)",
  "Near Mint (NM or M-)",
  "Very Good Plus (VG+)",
  "Very Good (VG)",
  "Good Plus (G+)",
  "Good (G)",
  "Fair (F)",
  "Poor (P)",
];

function conditionRank(value: string): number {
  const index = CONDITION_ORDER.indexOf(value);
  return index === -1 ? CONDITION_ORDER.length : index;
}

async function computeFacets(storeId: string): Promise<StoreFacets> {
  const items = await prisma.inventoryItem.findMany({
    where: { storeId, isVisible: true },
    select: {
      genres: true,
      styles: true,
      formatDescriptions: true,
      format: true,
      year: true,
      condition: true,
      label: true,
      country: true,
      price: true,
      isFeatured: true,
      detailVersion: true,
    },
  });

  const genre = new Counter();
  const style = new Counter();
  const format = new Counter();
  const decade = new Counter();
  const condition = new Counter();
  const label = new Counter();
  const country = new Counter();

  let min = Infinity;
  let max = -Infinity;
  let featuredCount = 0;
  let pendingDetail = 0;

  for (const item of items) {
    for (const value of parseJsonArray(item.genres)) genre.add(value);
    for (const value of parseJsonArray(item.styles)) style.add(value);

    // Fall back to the listing's own format string when the release lookup
    // hasn't happened yet, so the format filter works from the first sync.
    const formats = parseJsonArray(item.formatDescriptions);
    if (formats.length > 0) {
      for (const value of formats) format.add(value);
    } else {
      for (const value of splitFormatString(item.format)) format.add(value);
    }

    if (item.year && item.year >= 1900 && item.year <= 2100) {
      decade.add(String(Math.floor(item.year / 10) * 10));
    }
    condition.add(item.condition);
    label.add(item.label);
    country.add(item.country);

    if (item.price !== null) {
      min = Math.min(min, item.price);
      max = Math.max(max, item.price);
    }
    if (item.isFeatured) featuredCount += 1;
    if (item.detailVersion < DETAIL_VERSION) pendingDetail += 1;
  }

  return {
    genre: genre.top(30),
    style: style.top(40),
    format: format.top(24),
    decade: decade.sortedBy((a, b) => Number(b) - Number(a), (v) => `${v}s`),
    condition: condition.sortedBy((a, b) => conditionRank(a) - conditionRank(b), (v) => v),
    label: label.top(30),
    country: country.top(20),
    priceRange:
      min === Infinity
        ? null
        : { min: Math.floor(min), max: Math.ceil(max) },
    featuredCount,
    pendingDetail,
  };
}

/**
 * Facets cost a scan of the shop's whole catalogue, and the answer only changes
 * when items do, so hold it briefly in memory. Keyed on the sync timestamp as
 * well as the id, so a fresh sync is reflected straight away instead of waiting
 * out the TTL.
 */
const CACHE_TTL_MS = 120_000;
const cache = new Map<string, { at: number; value: Promise<StoreFacets> }>();

export function getStoreFacets(storeId: string, cacheKey: string | number): Promise<StoreFacets> {
  const key = `${storeId}:${cacheKey}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const value = computeFacets(storeId).catch((error: unknown) => {
    // Don't cache a failure: the next page view should try again.
    cache.delete(key);
    throw error;
  });

  // One store at a time is enough; this is a hot-path memo, not a store of record.
  if (cache.size > 50) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Test hook: clear the memo between cases. */
export function __resetFacetCacheForTest() {
  cache.clear();
}
