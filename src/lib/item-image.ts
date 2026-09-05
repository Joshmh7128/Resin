import { prisma } from "@/lib/prisma";
import { enrichItemFromRelease } from "@/lib/sync";
import { isRateLimited, rateLimitCooldownMs } from "@/lib/discogs";

export type ImageResolution =
  /** An image is cached and ready to display. */
  | { status: "ready"; imageUrl: string }
  /** The release genuinely has no artwork — don't ask again. */
  | { status: "none" }
  /** Queued for fetching; ask again shortly. */
  | { status: "pending" }
  /** No such item, or it isn't publicly visible. */
  | { status: "not-found" };

/**
 * Items waiting for a Discogs release lookup, drained by a single worker.
 *
 * Requests must never wait on Discogs directly. Discogs allows roughly one
 * request every 2.6s, so a page asking for 24 images would leave later requests
 * queued for a minute — long past any sane request timeout. Instead a request
 * only registers interest and returns immediately; the worker fetches in the
 * background and the client polls until the image lands in the cache.
 */
const queue: string[] = [];
const queued = new Set<string>();
let workerRunning = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueue(itemId: string) {
  if (queued.has(itemId)) return;
  queued.add(itemId);
  queue.push(itemId);
  void runWorker();
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

  // Someone else may have resolved it while this sat in the queue.
  if (!item || item.imageUrl || item.genres !== null) return;

  await enrichItemFromRelease(item, item.store.discogsToken);
}

async function runWorker(): Promise<void> {
  if (workerRunning) return;
  workerRunning = true;

  try {
    while (queue.length > 0) {
      // Wait out a rate-limit cooldown rather than burning through the queue
      // with requests that are guaranteed to fail.
      if (isRateLimited()) {
        await sleep(rateLimitCooldownMs() + 250);
        continue;
      }

      const itemId = queue.shift();
      if (!itemId) break;
      queued.delete(itemId);

      try {
        await fetchAndCache(itemId);
      } catch {
        // Leave it be — viewing the page again re-queues it, and a permanent
        // failure just means the item keeps showing no artwork.
      }
    }
  } finally {
    workerRunning = false;
  }
}

/**
 * Returns an item's cover image if we have it, and otherwise queues it to be
 * fetched. Always returns promptly — it never waits on Discogs.
 */
export async function resolveItemImage(itemId: string): Promise<ImageResolution> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, isVisible: true },
    select: { id: true, imageUrl: true, thumbUrl: true, genres: true },
  });

  if (!item) return { status: "not-found" };

  const cached = item.imageUrl ?? item.thumbUrl;
  if (cached) return { status: "ready", imageUrl: cached };

  // `genres` is only set once the release has been fetched. If it's set and we
  // still have no image, the release simply has no artwork.
  if (item.genres !== null) return { status: "none" };

  enqueue(item.id);
  return { status: "pending" };
}

/** Test hook: wait for the background worker to finish draining. */
export async function __drainImageQueueForTest(): Promise<void> {
  while (workerRunning || queue.length > 0) {
    await sleep(10);
  }
}

/** Test hook: clear queue state between cases. */
export function __resetImageQueueForTest(): void {
  queue.length = 0;
  queued.clear();
}
