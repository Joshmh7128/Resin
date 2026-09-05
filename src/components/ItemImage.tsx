"use client";

import { useEffect, useState } from "react";
import { withImageSlot } from "@/lib/image-queue";

/**
 * Polling budget. Requests are answered instantly (the server queues the actual
 * Discogs lookup in the background), so the wait here is for the queue to reach
 * this item. At ~2.6s per fetch, a full page can take a couple of minutes to
 * finish, so poll patiently rather than giving up and claiming there's no art.
 */
const MAX_ATTEMPTS = 45;
const RETRY_INTERVAL_MS = 3000;

type State =
  | { kind: "ready"; url: string }
  | { kind: "loading" }
  /** The server confirmed this release has no artwork. */
  | { kind: "none" }
  /** We stopped polling before getting an answer, which is not the same as "no image". */
  | { kind: "gave-up" };

/**
 * Shows an item's cover art, fetching it on demand when we don't have it yet.
 *
 * Most items arrive from Discogs' inventory endpoint without artwork, and
 * fetching every release up front is far too slow to do during a sync. So the
 * image for an item is resolved only when that item is actually rendered,
 * meaning only the page being looked at costs any Discogs requests.
 */
export function ItemImage({
  itemId,
  cachedUrl,
  alt,
  className,
}: {
  itemId: string;
  cachedUrl: string | null;
  alt: string;
  className?: string;
}) {
  const [state, setState] = useState<State>(
    cachedUrl ? { kind: "ready", url: cachedUrl } : { kind: "loading" },
  );

  useEffect(() => {
    if (cachedUrl) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function attempt(n: number): Promise<void> {
      if (cancelled) return;

      try {
        const result = await withImageSlot(async () => {
          const res = await fetch(`/api/items/${itemId}/image`);
          if (!res.ok) return { status: "none" as const };
          return (await res.json()) as { status: string; imageUrl?: string };
        });

        if (cancelled) return;

        if (result.status === "ready" && result.imageUrl) {
          setState({ kind: "ready", url: result.imageUrl });
          return;
        }
        if (result.status === "none") {
          setState({ kind: "none" });
          return;
        }
      } catch {
        // Fall through to the retry below.
      }

      // "pending" means it's queued but not fetched yet, so keep checking back.
      if (!cancelled && n < MAX_ATTEMPTS) {
        timer = setTimeout(() => void attempt(n + 1), RETRY_INTERVAL_MS);
      } else if (!cancelled) {
        // Running out of patience is not evidence that there's no artwork, so
        // don't claim there is none. Just stop asking.
        setState({ kind: "gave-up" });
      }
    }

    void attempt(1);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [itemId, cachedUrl]);

  if (state.kind === "ready") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={state.url} alt={alt} className={className} loading="lazy" />;
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-neutral-100 text-xs text-neutral-400 ${
        state.kind === "loading" ? "animate-pulse" : ""
      }`}
    >
      {/* Only say "No image" when the release really has none. While loading,
          or if we stopped polling, show a neutral placeholder instead. */}
      {state.kind === "none" ? "No image" : ""}
    </div>
  );
}
