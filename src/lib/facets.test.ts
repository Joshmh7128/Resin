import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getStoreFacets, __resetFacetCacheForTest } from "@/lib/facets";
import { buildWhere, parseStorefrontQuery } from "@/lib/storefront-query";

/**
 * Runs against the local Postgres from docker-compose. The point of these is
 * that the filter options a shop offers and the query that applies them agree:
 * every option offered has to return something when it is ticked.
 */

const STORE_SLUG = "facet-test-store";
let storeId: string;
let nextListingId = 800_000_001;

interface Fixture {
  title: string;
  artist?: string;
  genres?: string[];
  styles?: string[];
  formats?: string[];
  format?: string | null;
  year?: number | null;
  condition?: string | null;
  label?: string | null;
  country?: string | null;
  price?: number | null;
  featured?: boolean;
  visible?: boolean;
  /** Left at 0 to stand for an item the release lookup hasn't reached. */
  detailVersion?: number;
}

async function add(fixture: Fixture) {
  return prisma.inventoryItem.create({
    data: {
      storeId,
      listingId: BigInt(nextListingId++),
      releaseId: nextListingId,
      title: fixture.title,
      artist: fixture.artist ?? "Various",
      searchText: `${fixture.artist ?? "various"} ${fixture.title}`.toLowerCase(),
      genres: fixture.genres ? JSON.stringify(fixture.genres) : null,
      styles: fixture.styles ? JSON.stringify(fixture.styles) : null,
      formatDescriptions: fixture.formats ? JSON.stringify(fixture.formats) : null,
      format: fixture.format ?? null,
      year: fixture.year ?? null,
      condition: fixture.condition ?? null,
      label: fixture.label ?? null,
      country: fixture.country ?? null,
      price: fixture.price ?? null,
      isFeatured: fixture.featured ?? false,
      isVisible: fixture.visible ?? true,
      detailVersion: fixture.detailVersion ?? 1,
      discogsUri: "https://www.discogs.com/sell/item/1",
      releaseUri: "https://www.discogs.com/release/1",
      status: "For Sale",
    },
  });
}

/** Runs a facet selection through the real query, the way a page would. */
async function countMatching(params: Record<string, string>) {
  const query = parseStorefrontQuery(params, "grid");
  return prisma.inventoryItem.count({ where: buildWhere(storeId, query) });
}

beforeAll(async () => {
  const store = await prisma.store.upsert({
    where: { slug: STORE_SLUG },
    update: {},
    create: {
      slug: STORE_SLUG,
      name: "Facet Test Store",
      email: `${STORE_SLUG}@example.test`,
      passwordHash: "not-a-real-hash",
      discogsUsername: "facet-test",
    },
  });
  storeId = store.id;
});

afterAll(async () => {
  await prisma.store.deleteMany({ where: { slug: STORE_SLUG } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.inventoryItem.deleteMany({ where: { storeId } });
  __resetFacetCacheForTest();
});

describe("getStoreFacets", () => {
  it("offers only what the shop actually stocks", async () => {
    await add({ title: "A", genres: ["Jazz"], styles: ["Modal"] });
    await add({ title: "B", genres: ["Jazz", "Funk / Soul"], styles: ["Soul-Jazz"] });

    const facets = await getStoreFacets(storeId, "t1");

    expect(facets.genre.map((g) => g.value)).toEqual(["Jazz", "Funk / Soul"]);
    expect(facets.genre[0]).toMatchObject({ value: "Jazz", count: 2 });
    // A soul-only shop should never be offered a filter that returns nothing.
    expect(facets.genre.map((g) => g.value)).not.toContain("Classical");
  });

  it("leaves hidden items out entirely", async () => {
    await add({ title: "Shown", genres: ["Jazz"] });
    await add({ title: "Hidden", genres: ["Classical"], visible: false });

    const facets = await getStoreFacets(storeId, "t2");
    expect(facets.genre.map((g) => g.value)).toEqual(["Jazz"]);
  });

  it("falls back to the listing's format string before the release is looked up", async () => {
    // Format is the one tag available straight from the inventory endpoint, so
    // the filter should work from the first sync rather than after the warm.
    await add({ title: "A", format: "Vinyl, LP, Album, 33 ⅓ RPM", detailVersion: 0 });

    const facets = await getStoreFacets(storeId, "t3");
    const values = facets.format.map((f) => f.value);

    expect(values).toContain("LP");
    expect(values).toContain("Album");
    // A pressing speed is not something anyone browses by.
    expect(values).not.toContain("33 ⅓ RPM");
  });

  it("groups years into decades, newest first", async () => {
    await add({ title: "A", year: 1971 });
    await add({ title: "B", year: 1978 });
    await add({ title: "C", year: 1965 });
    await add({ title: "D", year: null });

    const facets = await getStoreFacets(storeId, "t4");
    expect(facets.decade).toEqual([
      { value: "1970", label: "1970s", count: 2 },
      { value: "1960", label: "1960s", count: 1 },
    ]);
  });

  it("orders conditions by the Discogs grading scale, not by popularity", async () => {
    // Buyers look for "this grade or better", so the scale's order is the
    // useful one even when almost everything is in one grade.
    await add({ title: "A", condition: "Very Good (VG)" });
    await add({ title: "B", condition: "Very Good (VG)" });
    await add({ title: "C", condition: "Mint (M)" });

    const facets = await getStoreFacets(storeId, "t5");
    expect(facets.condition.map((c) => c.value)).toEqual(["Mint (M)", "Very Good (VG)"]);
  });

  it("reports the price range and how many items are still awaiting a lookup", async () => {
    await add({ title: "A", price: 8.5, featured: true });
    await add({ title: "B", price: 42 });
    await add({ title: "C", price: null, detailVersion: 0 });

    const facets = await getStoreFacets(storeId, "t6");
    expect(facets.priceRange).toEqual({ min: 8, max: 42 });
    expect(facets.featuredCount).toBe(1);
    expect(facets.pendingDetail).toBe(1);
  });

  it("caches per store and generation, and re-reads when the generation changes", async () => {
    await add({ title: "A", genres: ["Jazz"] });
    const first = await getStoreFacets(storeId, "gen-1");

    await add({ title: "B", genres: ["Soul"] });
    expect(await getStoreFacets(storeId, "gen-1")).toBe(first);

    const second = await getStoreFacets(storeId, "gen-2");
    expect(second.genre).toHaveLength(2);
  });
});

describe("facets and filters agree", () => {
  it("returns records for every option it offers", async () => {
    await add({
      title: "Kind Of Blue",
      artist: "Miles Davis",
      genres: ["Jazz"],
      styles: ["Modal"],
      formats: ["Vinyl", "LP", "Album"],
      year: 1959,
      condition: "Near Mint (NM or M-)",
      label: "Columbia",
      country: "US",
      price: 45,
    });
    await add({
      title: "Innervisions",
      artist: "Stevie Wonder",
      genres: ["Funk / Soul"],
      styles: ["Soul"],
      formats: ["Vinyl", "LP"],
      year: 1973,
      condition: "Very Good Plus (VG+)",
      label: "Tamla",
      country: "UK",
      price: 22,
    });

    const facets = await getStoreFacets(storeId, "agree");

    for (const key of ["genre", "style", "format", "decade", "condition", "label", "country"] as const) {
      for (const option of facets[key]) {
        const param = { genre: "genre", style: "style", format: "format", decade: "decade", condition: "cond", label: "label", country: "country" }[key];
        const found = await countMatching({ [param]: option.value });
        expect(found, `${key}=${option.value} should return ${option.count}`).toBe(option.count);
      }
    }
  });

  it("matches whole tags rather than substrings", async () => {
    await add({ title: "A", styles: ["Techno"] });
    await add({ title: "B", styles: ["Tech House"] });

    expect(await countMatching({ style: "Techno" })).toBe(1);
    expect(await countMatching({ style: "Tech House" })).toBe(1);
  });

  it("widens on a second value in one facet and narrows across facets", async () => {
    await add({ title: "A", genres: ["Jazz"], condition: "Mint (M)" });
    await add({ title: "B", genres: ["Soul"], condition: "Very Good (VG)" });

    expect(await countMatching({ genre: "Jazz" })).toBe(1);
    expect(await countMatching({ genre: "Jazz,Soul" })).toBe(2);
    expect(await countMatching({ genre: "Jazz,Soul", cond: "Mint (M)" })).toBe(1);
  });

  it("never returns another store's records", async () => {
    const other = await prisma.store.create({
      data: {
        slug: `${STORE_SLUG}-other`,
        name: "Other",
        email: `${STORE_SLUG}-other@example.test`,
        passwordHash: "not-a-real-hash",
        discogsUsername: "other",
      },
    });
    try {
      await prisma.inventoryItem.create({
        data: {
          storeId: other.id,
          listingId: BigInt(nextListingId++),
          releaseId: 1,
          title: "Elsewhere",
          artist: "Other",
          searchText: "other elsewhere",
          genres: JSON.stringify(["Jazz"]),
          discogsUri: "https://www.discogs.com/sell/item/2",
          releaseUri: "https://www.discogs.com/release/2",
          status: "For Sale",
        },
      });

      expect(await countMatching({ genre: "Jazz" })).toBe(0);
      expect((await getStoreFacets(storeId, "scoped")).genre).toEqual([]);
    } finally {
      await prisma.store.delete({ where: { id: other.id } });
    }
  });
});
