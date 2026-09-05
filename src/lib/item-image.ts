import { prisma } from "@/lib/prisma";
import { enrichItemFromRelease } from "@/lib/sync";

/**
 * How long a single image request may spend waiting on Discogs before we give
 * up and tell the client to retry. Discogs is throttled to one request every
 * ~2.6s process-wide, so a request that queues behind others must not sit open
 * long enough to hit the platform's ~15s request timeout.
 */
export const IMAGE_DEADLINE_MS = 9000;

export type ImageResolution =
  /** An image is cached and ready to display. */
  | { status: "ready"; imageUrl: string }
  /** The release genuinely has no artwork — don't ask again. */
  | { status: "none" }
  /** Couldn't resolve in time (throttled or transient failure) — retry later. */
  | { status: "pending" }
  /** No such item, or it isn't publicly visible. */
  | { status: "not-found" };

/**
 * Resolves the cover image for a single item, fetching it from Discogs only if
 * we don't already have it.
 *
 * Discogs' inventory endpoint usually omits artwork, so the image has to come
 * from the release resource — one HTTP call per item. Fetching a whole store's
 * worth up front is far too slow, so images are resolved one at a time, on
 * demand, for the items actually on screen. Results are cached permanently, so
 * each release is only ever fetched once.
 */
export async function resolveItemImage(
  itemId: string,
  { deadlineMs = IMAGE_DEADLINE_MS }: { deadlineMs?: number } = {},
): Promise<ImageResolution> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, isVisible: true },
    select: {
      id: true,
      releaseId: true,
      imageUrl: true,
      thumbUrl: true,
      genres: true,
      store: { select: { discogsToken: true } },
    },
  });

  if (!item) return { status: "not-found" };

  const cached = item.imageUrl ?? item.thumbUrl;
  if (cached) return { status: "ready", imageUrl: cached };

  // `genres` is only set once the release has been fetched. If it's set and we
  // still have no image, the release simply has no artwork — fetching again
  // would burn rate limit to learn the same thing.
  if (item.genres !== null) return { status: "none" };

  // Let the fetch keep running past our deadline rather than cancelling it: the
  // result still gets cached, so a retry will find it already there.
  const enrichment = enrichItemFromRelease(item, item.store.discogsToken);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), deadlineMs);
  });

  try {
    const outcome = await Promise.race([
      enrichment.then((details) => details.images[0] ?? null),
      deadline,
    ]);

    if (outcome === "timeout") return { status: "pending" };
    if (!outcome) return { status: "none" };
    return { status: "ready", imageUrl: outcome };
  } catch {
    // A failed release lookup (removed release, rate limit, network blip) is
    // retryable — the client can ask again rather than showing a hard error.
    return { status: "pending" };
  } finally {
    if (timer) clearTimeout(timer);
    // Don't let a rejection after the race resolves become an unhandled one.
    void enrichment.catch(() => {});
  }
}
