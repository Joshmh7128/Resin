import { describe, it, expect } from "vitest";
import {
  buildWhere,
  clearFiltersHref,
  hasActiveFilters,
  pageHref,
  parseStorefrontQuery,
  queryHref,
  toggleFacetHref,
} from "@/lib/storefront-query";

const BASE = "/store/demo";

function parse(params: Record<string, string | string[] | undefined>) {
  return parseStorefrontQuery(params, "grid");
}

describe("parseStorefrontQuery", () => {
  it("uses the shop's default layout when the customer hasn't chosen one", () => {
    expect(parse({}).layout).toBe("grid");
    expect(parseStorefrontQuery({}, "coverflow").layout).toBe("coverflow");
  });

  it("reads facets both comma-joined and repeated", () => {
    // Our own links join with commas to keep a shared URL short; the filter
    // form is a plain GET form, whose checkboxes repeat the key instead.
    expect(parse({ genre: "Rock,Jazz" }).facets.genre).toEqual(["Rock", "Jazz"]);
    expect(parse({ genre: ["Rock", "Jazz"] }).facets.genre).toEqual(["Rock", "Jazz"]);
  });

  it("drops duplicates and caps how much a URL can ask for", () => {
    expect(parse({ genre: "Rock,Rock,Jazz" }).facets.genre).toEqual(["Rock", "Jazz"]);
    expect(parse({ style: Array.from({ length: 60 }, (_, i) => `s${i}`).join(",") }).facets.style)
      .toHaveLength(25);
    expect(parse({ genre: "x".repeat(200) }).facets.genre).toEqual([]);
  });

  it("ignores values it doesn't understand rather than failing the page", () => {
    expect(parse({ sort: "cheapest" }).sort).toBe("newest");
    expect(parse({ view: "spiral" }).layout).toBe("grid");
    expect(parse({ page: "-4" }).page).toBe(1);
    expect(parse({ page: "banana" }).page).toBe(1);
    expect(parse({ pmin: "-10" }).priceMin).toBeNull();
  });

  it("treats anything but feat=1 as not filtering to featured", () => {
    expect(parse({ feat: "1" }).featuredOnly).toBe(true);
    expect(parse({ feat: "true" }).featuredOnly).toBe(false);
    expect(parse({}).featuredOnly).toBe(false);
  });
});

describe("hasActiveFilters", () => {
  it("does not count a plain search or a sort as a filter", () => {
    expect(hasActiveFilters(parse({ q: "coltrane", sort: "price_asc" }))).toBe(false);
    expect(hasActiveFilters(parse({ genre: "Jazz" }))).toBe(true);
    expect(hasActiveFilters(parse({ pmax: "20" }))).toBe(true);
  });
});

describe("buildWhere", () => {
  it("always scopes to the store's visible items", () => {
    const where = buildWhere("store-1", parse({}));
    expect(where.storeId).toBe("store-1");
    expect(where.isVisible).toBe(true);
    expect(where.AND).toBeUndefined();
  });

  it("matches whole tags, not substrings", () => {
    // Genres are stored as a JSON array string, so matching a bare substring
    // would make "Techno" also return every "Tech House" record.
    const where = buildWhere("store-1", parse({ genre: "Rock" }));
    expect(where.AND).toEqual([{ OR: [{ genres: { contains: '"Rock"' } }] }]);
  });

  it("escapes a tag the same way it was stored", () => {
    const where = buildWhere("store-1", parse({ style: 'Hard "Rock"' }));
    expect(where.AND).toEqual([{ OR: [{ styles: { contains: '"Hard \\"Rock\\""' } }] }]);
  });

  it("ORs within one facet and ANDs across facets", () => {
    // Ticking a second genre should widen the results; ticking a different
    // facet should narrow them. That is what faceted browsing means.
    const where = buildWhere("store-1", parse({ genre: "Rock,Jazz", cond: "Mint (M)" }));
    expect(where.AND).toEqual([
      { OR: [{ genres: { contains: '"Rock"' } }, { genres: { contains: '"Jazz"' } }] },
      { condition: { in: ["Mint (M)"] } },
    ]);
  });

  it("turns a decade into a year range", () => {
    const where = buildWhere("store-1", parse({ decade: "1970" }));
    expect(where.AND).toEqual([{ OR: [{ year: { gte: 1970, lte: 1979 } }] }]);
  });

  it("ignores a decade that isn't a plausible year", () => {
    expect(buildWhere("store-1", parse({ decade: "abcd" })).AND).toBeUndefined();
    expect(buildWhere("store-1", parse({ decade: "3000" })).AND).toBeUndefined();
  });

  it("applies each end of the price range independently", () => {
    expect(buildWhere("store-1", parse({ pmin: "10" })).AND).toEqual([{ price: { gte: 10 } }]);
    expect(buildWhere("store-1", parse({ pmax: "40" })).AND).toEqual([{ price: { lte: 40 } }]);
  });
});

describe("links", () => {
  it("leaves defaults out of the URL", () => {
    expect(queryHref(BASE, parse({}), "grid", { sort: "newest" })).toBe(BASE);
    expect(queryHref(BASE, parse({}), "grid", { layout: "grid" })).toBe(BASE);
    expect(queryHref(BASE, parse({}), "grid", { layout: "list" })).toBe(`${BASE}?view=list`);
  });

  it("keeps the rest of the query when one thing changes", () => {
    const query = parse({ q: "miles", genre: "Jazz", view: "list" });
    const href = queryHref(BASE, query, "grid", { sort: "price_asc" });

    expect(href).toContain("q=miles");
    expect(href).toContain("genre=Jazz");
    expect(href).toContain("view=list");
    expect(href).toContain("sort=price_asc");
  });

  it("returns to page one whenever the results change", () => {
    // Staying on page 9 of a narrower result set lands on an empty page.
    const query = parse({ page: "9", genre: "Jazz" });
    expect(toggleFacetHref(BASE, query, "grid", "genre", "Soul")).not.toContain("page=");
    expect(clearFiltersHref(BASE, query, "grid")).not.toContain("page=");
  });

  it("toggles a facet value off when it is already on", () => {
    const query = parse({ genre: "Jazz,Soul" });
    expect(toggleFacetHref(BASE, query, "grid", "genre", "Soul")).toBe(`${BASE}?genre=Jazz`);
    expect(toggleFacetHref(BASE, query, "grid", "genre", "Funk")).toBe(
      `${BASE}?genre=Jazz%2CSoul%2CFunk`,
    );
  });

  it("keeps filters on a page link, and omits page=1", () => {
    const query = parse({ genre: "Jazz" });
    expect(pageHref(BASE, query, "grid", 1)).toBe(`${BASE}?genre=Jazz`);
    expect(pageHref(BASE, query, "grid", 3)).toBe(`${BASE}?genre=Jazz&page=3`);
  });

  it("clears filters but keeps the search, sort and layout", () => {
    const query = parse({ q: "miles", sort: "price_asc", view: "list", genre: "Jazz", pmax: "30" });
    const href = clearFiltersHref(BASE, query, "grid");

    expect(href).toContain("q=miles");
    expect(href).toContain("sort=price_asc");
    expect(href).toContain("view=list");
    expect(href).not.toContain("genre");
    expect(href).not.toContain("pmax");
  });
});
