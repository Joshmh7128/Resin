"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { syncInventoryAction, getSyncStatusAction, type SyncStatus } from "@/lib/actions";

const POLL_INTERVAL_MS = 2500;

export function SyncButton({ initialStatus }: { initialStatus: SyncStatus }) {
  const router = useRouter();
  const [running, setRunning] = useState(initialStatus.running);
  const [images, setImages] = useState(initialStatus.images);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  // Item count when the sync started, so we can report what actually changed.
  const countAtStart = useRef<number | null>(null);

  const finish = useCallback(
    (status: SyncStatus) => {
      setRunning(false);
      if (status.status === "error") {
        setMessage({ type: "error", text: status.error ?? "Sync failed" });
      } else {
        const before = countAtStart.current;
        const delta = before === null ? null : status.totalItems - before;
        const suffix =
          delta === null || delta === 0
            ? ""
            : ` (${delta > 0 ? "+" : ""}${delta} item${Math.abs(delta) === 1 ? "" : "s"})`;
        setMessage({
          type: "success",
          text: `Synced ${status.totalItems} listings${suffix}`,
        });
      }
      countAtStart.current = null;
      // Pull the dashboard's server-rendered stats back in line with the result.
      router.refresh();
    },
    [router],
  );

  // Poll while either the listing sync or the cover-art fill is in progress.
  // Artwork keeps loading after the sync itself finishes, so the two are
  // tracked separately. This also resumes correctly after a page reload.
  const shouldPoll = running || images.warming;

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const status = await getSyncStatusAction();
        if (cancelled) return;
        setImages(status.images);
        if (running && !status.running) finish(status);
      } catch {
        // Transient failure (a redeploy, a dropped connection), so keep polling
        // rather than reporting a failure we can't actually confirm.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [shouldPoll, running, finish]);

  async function handleClick() {
    setMessage(null);
    try {
      const status = await getSyncStatusAction();
      countAtStart.current = status.totalItems;
    } catch {
      countAtStart.current = null;
    }

    const result = await syncInventoryAction();
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setRunning(true);
  }

  const percent =
    images.total > 0 ? Math.round((images.resolved / images.total) * 100) : 100;

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={running}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {running ? "Syncing from Discogs…" : "Sync inventory now"}
      </button>

      {running && (
        <p className="text-sm text-neutral-500">
          This runs in the background and takes a minute or two. You can leave this page.
        </p>
      )}

      {images.remaining > 0 && (
        <div className="max-w-sm space-y-1 pt-1">
          <p className="text-sm text-neutral-500">
            {images.warming ? "Loading cover art:" : "Cover art paused:"}{" "}
            {images.resolved.toLocaleString()} of {images.total.toLocaleString()} done,{" "}
            {images.remaining.toLocaleString()} to go.
            {images.warming && " Customers browsing the shop are served first, so this may slow down."}
          </p>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Cover art loading progress"
          >
            <div
              className="h-full bg-neutral-900 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-neutral-400">
            Cover art loads gradually because Discogs limits how fast we can ask for
            it. Your shop also sleeps after 15 minutes with no visitors, which pauses
            loading. It picks up again automatically the next time anyone views your
            storefront, or when you press Sync. Nothing already loaded is lost.
          </p>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-700"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
