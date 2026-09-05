import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mock only the network call; everything else (Prisma, caching) is real, so
// these tests exercise the actual persistence behaviour against local Postgres.
vi.mock("@/lib/discogs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/discogs")>();
  return { ...actual, fetchReleaseDetails: vi.fn() };
});

import { prisma } from "@/lib/prisma";
import { fetchReleaseDetails } from "@/lib/discogs";
import { resolveItemImage } from "@/lib/item-image";

const mockFetch = vi.mocked(fetchReleaseDetails);

const STORE_SLUG = "image-test-store";
let storeId: string;
let nextListingId = 900_000_001;

function releaseDetails(images: string[]) {
  return {
    genres: ["Jazz"],
    styles: ["Modal"],
    images,
    notes: null,
    tracklist: [],
    labels: [],
  };
}

async function makeItem(overrides: {
  imageUrl?: string | null;
  thumbUrl?: string | null;
  genres?: string | null;
  isVisible?: boolean;
}) {
  return prisma.inventoryItem.create({
    data: {
      storeId,
      listingId: BigInt(nextListingId++),
      releaseId: 12345,
      title: "Test Record",
      artist: "Test Artist",
      searchText: "test artist test record",
      discogsUri: "https://www.discogs.com/sell/item/1",
      releaseUri: "https://www.discogs.com/release/12345",
      status: "For Sale",
      imageUrl: overrides.imageUrl ?? null,
      thumbUrl: overrides.thumbUrl ?? null,
      genres: overrides.genres ?? null,
      isVisible: overrides.isVisible ?? true,
    },
  });
}

beforeAll(async () => {
  await prisma.store.deleteMany({ where: { slug: STORE_SLUG } });
  const store = await prisma.store.create({
    data: {
      slug: STORE_SLUG,
      name: "Image Test Store",
      email: "image-test@example.com",
      passwordHash: "not-a-real-hash",
      discogsUsername: "example",
    },
  });
  storeId = store.id;
});

afterAll(async () => {
  await prisma.store.deleteMany({ where: { slug: STORE_SLUG } });
  await prisma.$disconnect();
});

beforeEach(() => {
  mockFetch.mockReset();
});

describe("resolveItemImage", () => {
  it("returns a cached image without calling Discogs", async () => {
    const item = await makeItem({ imageUrl: "https://img.discogs.com/cached.jpg" });

    const result = await resolveItemImage(item.id);

    expect(result).toEqual({
      status: "ready",
      imageUrl: "https://img.discogs.com/cached.jpg",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("falls back to the listing thumbnail without calling Discogs", async () => {
    const item = await makeItem({ thumbUrl: "https://img.discogs.com/thumb.jpg" });

    const result = await resolveItemImage(item.id);

    expect(result).toEqual({
      status: "ready",
      imageUrl: "https://img.discogs.com/thumb.jpg",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches the release when nothing is cached, and persists the result", async () => {
    const item = await makeItem({});
    mockFetch.mockResolvedValue(releaseDetails(["https://img.discogs.com/fetched.jpg"]));

    const result = await resolveItemImage(item.id);

    expect(result).toEqual({
      status: "ready",
      imageUrl: "https://img.discogs.com/fetched.jpg",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const stored = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.imageUrl).toBe("https://img.discogs.com/fetched.jpg");
    expect(stored.genres).toBe(JSON.stringify(["Jazz"]));
  });

  it("serves the second request from cache instead of refetching", async () => {
    const item = await makeItem({});
    mockFetch.mockResolvedValue(releaseDetails(["https://img.discogs.com/once.jpg"]));

    await resolveItemImage(item.id);
    const second = await resolveItemImage(item.id);

    expect(second).toEqual({ status: "ready", imageUrl: "https://img.discogs.com/once.jpg" });
    // The whole point of caching: one Discogs call per release, ever.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("reports 'none' when the release genuinely has no artwork", async () => {
    const item = await makeItem({});
    mockFetch.mockResolvedValue(releaseDetails([]));

    const result = await resolveItemImage(item.id);

    expect(result).toEqual({ status: "none" });
  });

  it("does not refetch a release already known to have no artwork", async () => {
    // `genres` set with no image is how we record "already looked, found none".
    const item = await makeItem({ genres: JSON.stringify(["Jazz"]) });

    const result = await resolveItemImage(item.id);

    expect(result).toEqual({ status: "none" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 'pending' when Discogs is too slow, rather than hanging", async () => {
    const item = await makeItem({});
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(releaseDetails(["https://img.discogs.com/slow.jpg"])), 300),
        ),
    );

    const started = Date.now();
    const result = await resolveItemImage(item.id, { deadlineMs: 25 });
    const elapsed = Date.now() - started;

    expect(result).toEqual({ status: "pending" });
    // Must give up quickly — this is what keeps a request under the platform's
    // ~15s timeout when many images are queued behind the Discogs throttle.
    expect(elapsed).toBeLessThan(250);
  });

  it("still caches an image that arrives after the deadline passed", async () => {
    const item = await makeItem({});
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(releaseDetails(["https://img.discogs.com/late.jpg"])), 100),
        ),
    );

    expect(await resolveItemImage(item.id, { deadlineMs: 10 })).toEqual({ status: "pending" });

    // The in-flight fetch is deliberately not cancelled, so a retry finds it.
    await new Promise((r) => setTimeout(r, 250));
    const retry = await resolveItemImage(item.id);
    expect(retry).toEqual({ status: "ready", imageUrl: "https://img.discogs.com/late.jpg" });
  });

  it("returns 'pending' when the release lookup fails", async () => {
    const item = await makeItem({});
    mockFetch.mockRejectedValue(new Error("Discogs 502"));

    const result = await resolveItemImage(item.id);

    expect(result).toEqual({ status: "pending" });
  });

  it("will not resolve an image for a hidden item", async () => {
    const item = await makeItem({ imageUrl: "https://img.discogs.com/hidden.jpg", isVisible: false });

    expect(await resolveItemImage(item.id)).toEqual({ status: "not-found" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 'not-found' for an unknown item", async () => {
    expect(await resolveItemImage("does-not-exist")).toEqual({ status: "not-found" });
  });
});
