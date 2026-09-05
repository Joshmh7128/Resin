import { prisma } from "@/lib/prisma";
import { fetchReleaseDetails, isRateLimited, rateLimitCooldownMs } from "@/lib/discogs";
import type { InventoryItem } from "@prisma/client";

export type ImageResolution =
  /** An image is cached and ready to display. */
  | { status: "ready"; imageUrl: string }
  /** The release genuinely has no artwork — don't ask again. */
  | { status: "none" }
  /** Queued for fetching; ask again shortly. */
  | { status: "pending" }
  /** No such item, or it isn't publicly visible. */
  | { status: "not-found" };

export interface ImageProgress {
  /** Visible items in the store. */
  total: number;
  /** Items whose release has been looked up (image found or confirmed absent). */
  resolved: number;
  /** Items still waiting on a Discogs lookup. */
  remaining: number;
  /** Whether this store is currently being warmed in the background. */
  warming: boolean;
}

/**
 * Fetches the full release (genres, styles, images, notes, tracklist) and caches
 * it on the item. This is the single place a release lookup is turned into
 * stored data, used by on-demand requests, background warming, and the item
 * detail page alike.
 */
export async function enrichItemFromRelease(
  item: Pick<InventoryItem, "id" | "releaseId" | "thumbUrl">,
  token: string | null | undefined,
) {
  const details = await fetchReleaseDetails(item.releaseId, token);
  await prisma.inventoryItem.update({
    where: { id: item.id },
    data: {
      genres: JSON.stringify(details.genres),
      styles: JSON.stringify(details.styles),
      // We store the Discogs CDN URL, never the image bytes — a few hundred
      // bytes per item, and it disappears with the row when a listing sells.
      imageUrl: details.images[0] ?? item.thumbUrl,
      rawData: JSON.stringify({
        notes: details.notes,
        tracklist: details.tracklist,
        labels: details.labels,
        images: details.images,
      }),
    },
  });
  return details;
}

/**
 * A single worker drains two tiers of work against the shared Discogs throttle.
 *
 * `priority` holds items a customer is looking at right now; `warmingStores`
 * holds stores being filled in ahead of time. Priority always wins, so browsing
 * never queues behind a warm that may have thousands of items left to do. Both
 * tiers write to the same cache, so a page view also advances the warm — an item
 * fetched on demand is simply no longer outstanding.
 *
 * Warming is tracked as a set of store ids rather than a list of item ids: the
 * next item is queried from the database when needed, so memory stays small
 * regardless of catalogue size and newly synced items are picked up for free.
 */
const priorityQueue: string[] = [];
const priorityQueued = new Set<string>();
const warmingStores = new Set<string>();
let workerRunning = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueuePriority(itemId: string) {
  if (priorityQueued.has(itemId)) return;
  priorityQueued.add(itemId);
  priorityQueue.push(itemId);
  void runWorker();
}

/** Begin (or resume) filling in every missing image for a store. */
export function startWarmingStore(storeId: string) {
  warmingStores.add(storeId);
  void runWorker();
}

export function isWarmingStore(storeId: string) {
  return warmingStores.has(storeId);
}

/**
 * Finds the next item needing a lookup in any warming store. Returns null when
 * every warming store is fully resolved, dropping them as they complete.
 */
async function nextWarmingItem(): Promise<string | null> {
  for (const storeId of Array.from(warmingStores)) {
    const item = await prisma.inventoryItem.findFirst({
      where: { storeId, isVisible: true, imageUrl: null, genres: null },
      select: { id: true },
      // Newest listings first — most likely to be what someone browses. Uses
      // `createdAt` because caching artwork bumps `updatedAt`, which would make
      // this ordering shift as the warm progresses.
      orderBy: { createdAt: "desc" },
    });
    if (item) return item.id;
    warmingStores.delete(storeId);
  }
  return null;
}

async function fetchAndCache(itemId: string): Promise<void> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, isVisible: true },
    select: {
      id: true,
      releaseId: true,
      thumbUrl: true,
      genres: true,
      imageUrl: true,
      store: { select: { discogsToken: true } },
    },
  });

  // Another path may have resolved it while this was queued.
  if (!item || item.imageUrl || item.genres !== null) return;

  await enrichItemFromRelease(item, item.store.discogsToken);
}

async function runWorker(): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;

  try {
    for (;;) {
      if (isRateLimited()) {
        await sleep(rateLimitCooldownMs() + 250);
        continue;
      }

      // Customer-facing work first, always.
      const itemId = priorityQueue.shift() ?? (await nextWarmingItem());
      if (!itemId) break;
      priorityQueued.delete(itemId);

      try {
        await fetchAndCache(itemId);
      } catch {
        // A permanently broken release shouldn't stall the queue. If it was a
        // warm item it stays unresolved and will be retried on a later pass;
        // the store simply shows no artwork for it.
        if (warmingStores.size > 0) {
          // Avoid spinning on a release that keeps failing.
          await sleep(50);
        }
      }
    }
  } finally {
    workerRunning = false;
  }
}

/**
 * Returns an item's cover image if we have it, and otherwise queues it at
 * priority. Always returns promptly — it never waits on Discogs.
 */
export async function resolveItemImage(itemId: string): Promise<ImageResolution> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, isVisible: true },
    select: { id: true, storeId: true, imageUrl: true, thumbUrl: true, genres: true },
  });

  if (!item) return { status: "not-found" };

  const cached = item.imageUrl ?? item.thumbUrl;
  if (cached) return { status: "ready", imageUrl: cached };

  // `genres` is only set once the release has been fetched. If it's set and we
  // still have no image, the release simply has no artwork.
  if (item.genres !== null) return { status: "none" };

  enqueuePriority(item.id);

  // Someone is browsing a store that still has unresolved artwork, so make sure
  // the background fill is running too. Warming otherwise only starts after a
  // sync, and it lives in memory — so a restart or an idle spin-down would
  // leave it stopped until the owner happened to sync again. This makes any
  // visit resume it. It's idempotent: already-warming stores are a no-op, and
  // the warmer always yields to the priority queue, so the visitor's own images
  // are unaffected.
  startWarmingStore(item.storeId);

  return { status: "pending" };
}

/** How much of a store's artwork has been resolved so far. */
export async function getImageProgress(storeId: string): Promise<ImageProgress> {
  const [total, remaining] = await Promise.all([
    prisma.inventoryItem.count({ where: { storeId, isVisible: true } }),
    prisma.inventoryItem.count({
      where: { storeId, isVisible: true, imageUrl: null, genres: null },
    }),
  ]);

  return {
    total,
    resolved: total - remaining,
    remaining,
    warming: warmingStores.has(storeId) && remaining > 0,
  };
}

/** Test hook: wait for the worker to finish all outstanding work. */
export async function __drainImageQueueForTest(): Promise<void> {
  while (workerRunning || priorityQueue.length > 0 || warmingStores.size > 0) {
    await sleep(10);
  }
}

/** Test hook: clear queue state between cases. */
export function __resetImageQueueForTest(): void {
  priorityQueue.length = 0;
  priorityQueued.clear();
  warmingStores.clear();
}

/** Test hook: inspect queue state. */
export function __getImageQueueStateForTest() {
  return {
    priority: [...priorityQueue],
    warming: [...warmingStores],
    running: workerRunning,
  };
}
