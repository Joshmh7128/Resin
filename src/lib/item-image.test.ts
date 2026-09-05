import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mock only the network call; everything else (Prisma, queueing, caching) is
// real, so these tests exercise actual persistence against local Postgres.
vi.mock("@/lib/discogs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/discogs")>();
  return { ...actual, fetchReleaseDetails: vi.fn() };
});

import { prisma } from "@/lib/prisma";
import { fetchReleaseDetails } from "@/lib/discogs";
import {
  resolveItemImage,
  __drainImageQueueForTest,
  __resetImageQueueForTest,
} from "@/lib/item-image";

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

beforeEach(async () => {
  await __drainImageQueueForTest();
  __resetImageQueueForTest();
  mockFetch.mockReset();
});

describe("resolveItemImage", () => {
  it("returns a cached image without touching Discogs", async () => {
    const item = await makeItem({ imageUrl: "https://img.discogs.com/cached.jpg" });

    expect(await resolveItemImage(item.id)).toEqual({
      status: "ready",
      imageUrl: "https://img.discogs.com/cached.jpg",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("falls back to the listing thumbnail without touching Discogs", async () => {
    const item = await makeItem({ thumbUrl: "https://img.discogs.com/thumb.jpg" });

    expect(await resolveItemImage(item.id)).toEqual({
      status: "ready",
      imageUrl: "https://img.discogs.com/thumb.jpg",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns immediately rather than waiting on the Discogs fetch", async () => {
    const item = await makeItem({});
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(releaseDetails(["https://img.discogs.com/slow.jpg"])), 300),
        ),
    );

    const started = Date.now();
    const result = await resolveItemImage(item.id);
    const elapsed = Date.now() - started;

    expect(result).toEqual({ status: "pending" });
    // This is the property that keeps requests clear of the platform timeout:
    // the response must not be coupled to how slow Discogs is.
    expect(elapsed).toBeLessThan(150);

    await __drainImageQueueForTest();
  });

  it("caches the image in the background, so a later request finds it", async () => {
    const item = await makeItem({});
    mockFetch.mockResolvedValue(releaseDetails(["https://img.discogs.com/fetched.jpg"]));

    expect(await resolveItemImage(item.id)).toEqual({ status: "pending" });
    await __drainImageQueueForTest();

    expect(await resolveItemImage(item.id)).toEqual({
      status: "ready",
      imageUrl: "https://img.discogs.com/fetched.jpg",
    });

    const stored = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.imageUrl).toBe("https://img.discogs.com/fetched.jpg");
    expect(stored.genres).toBe(JSON.stringify(["Jazz"]));
  });

  it("fetches a given release only once, however many times it is asked for", async () => {
    const item = await makeItem({});
    mockFetch.mockResolvedValue(releaseDetails(["https://img.discogs.com/once.jpg"]));

    // Simulate several cards on a page all asking at the same moment.
    await Promise.all([
      resolveItemImage(item.id),
      resolveItemImage(item.id),
      resolveItemImage(item.id),
    ]);
    await __drainImageQueueForTest();
    await resolveItemImage(item.id);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("reports 'none' when the release genuinely has no artwork", async () => {
    const item = await makeItem({});
    mockFetch.mockResolvedValue(releaseDetails([]));

    expect(await resolveItemImage(item.id)).toEqual({ status: "pending" });
    await __drainImageQueueForTest();

    expect(await resolveItemImage(item.id)).toEqual({ status: "none" });
  });

  it("does not refetch a release already known to have no artwork", async () => {
    const item = await makeItem({ genres: JSON.stringify(["Jazz"]) });

    expect(await resolveItemImage(item.id)).toEqual({ status: "none" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("survives a failed lookup and keeps draining the queue", async () => {
    const failing = await makeItem({});
    const succeeding = await makeItem({});

    mockFetch
      .mockRejectedValueOnce(new Error("Discogs 502"))
      .mockResolvedValue(releaseDetails(["https://img.discogs.com/after-failure.jpg"]));

    await resolveItemImage(failing.id);
    await resolveItemImage(succeeding.id);
    await __drainImageQueueForTest();

    // One bad release must not stall everything queued behind it.
    expect(await resolveItemImage(succeeding.id)).toEqual({
      status: "ready",
      imageUrl: "https://img.discogs.com/after-failure.jpg",
    });
  });

  it("processes a whole page of items without dropping any", async () => {
    const items = [];
    for (let i = 0; i < 12; i += 1) items.push(await makeItem({}));
    mockFetch.mockResolvedValue(releaseDetails(["https://img.discogs.com/page.jpg"]));

    await Promise.all(items.map((item) => resolveItemImage(item.id)));
    await __drainImageQueueForTest();

    const resolved = await Promise.all(items.map((item) => resolveItemImage(item.id)));
    expect(resolved.every((r) => r.status === "ready")).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(12);
  });

  it("will not resolve an image for a hidden item", async () => {
    const item = await makeItem({
      imageUrl: "https://img.discogs.com/hidden.jpg",
      isVisible: false,
    });

    expect(await resolveItemImage(item.id)).toEqual({ status: "not-found" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 'not-found' for an unknown item", async () => {
    expect(await resolveItemImage("does-not-exist")).toEqual({ status: "not-found" });
  });
});
