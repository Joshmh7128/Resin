"use client";

import { useEffect, useState } from "react";
import { withImageSlot } from "@/lib/image-queue";

const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 3000;

type State =
  | { kind: "ready"; url: string }
  | { kind: "loading" }
  | { kind: "none" };

/**
 * Shows an item's cover art, fetching it on demand when we don't have it yet.
 *
 * Most items arrive from Discogs' inventory endpoint without artwork, and
 * fetching every release up front is far too slow to do during a sync. So the
 * image for an item is resolved only when that item is actually rendered —
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

      // "pending" means Discogs was too busy to answer in time — back off and
      // try again rather than giving up on an image that probably exists.
      if (!cancelled && n < MAX_ATTEMPTS) {
        timer = setTimeout(() => void attempt(n + 1), RETRY_BASE_MS * n);
      } else if (!cancelled) {
        setState({ kind: "none" });
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
      {state.kind === "loading" ? "" : "No image"}
    </div>
  );
}
