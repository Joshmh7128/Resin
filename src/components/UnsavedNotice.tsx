"use client";

import { useFormStatus } from "react-dom";

/**
 * Tells someone their change isn't live yet.
 *
 * Nothing on these forms applies as you touch it, and a colour or a layout
 * changing in a preview looks enough like it took effect that the save step is
 * easy to walk away from. Hidden while a save is in flight, so it can't sit
 * next to a "Saving…" button contradicting it.
 */
export function UnsavedNotice({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  if (!dirty || pending) return null;

  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-amber-700">
      <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 fill-current">
        <path d="M8 1.5 15 14H1zM7.25 6v4h1.5V6zm0 5.25v1.5h1.5v-1.5z" />
      </svg>
      Not saved yet. Choose Save to put this on your storefront.
    </p>
  );
}
