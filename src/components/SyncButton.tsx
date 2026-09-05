"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { syncInventoryAction, getSyncStatusAction, type SyncStatus } from "@/lib/actions";

const POLL_INTERVAL_MS = 2500;

export function SyncButton({ initialStatus }: { initialStatus: SyncStatus }) {
  const router = useRouter();
  const [running, setRunning] = useState(initialStatus.running);
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
        const delta =
          before === null ? null : status.totalItems - before;
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

  // Poll while a sync is in flight. This also covers a sync that was already
  // running when the page loaded — e.g. after a refresh mid-sync.
  useEffect(() => {
    if (!running) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const status = await getSyncStatusAction();
        if (cancelled) return;
        if (!status.running) finish(status);
      } catch {
        // Transient failure (a redeploy, a dropped connection) — keep polling
        // rather than reporting a sync failure we can't actually confirm.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [running, finish]);

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
          This runs in the background and takes a minute or two — you can leave this page.
        </p>
      )}
      {message && (
        <p
          className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
