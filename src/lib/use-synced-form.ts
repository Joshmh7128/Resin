"use client";

import { useState } from "react";

/**
 * Keeps a form's fields as controlled state that follows the saved values.
 *
 * Two problems this solves, both of which showed up as a field snapping back to
 * its old value after a save:
 *
 * React resets a form's *uncontrolled* fields once its action finishes. The
 * fresh values only arrive a moment later, when the page revalidates, so the
 * form visibly reverts and then corrects itself. Worse, a `defaultValue` that
 * changes afterwards is ignored by an already-mounted input, so a text field
 * could sit showing the old value until a full reload.
 *
 * Holding the values in state fixes the first, and re-syncing when the saved
 * values change fixes the second. The comparison is on the serialized saved
 * values rather than object identity, since a server component hands down a new
 * object on every render.
 */
export function useSyncedForm<T extends object>(saved: T) {
  const savedKey = JSON.stringify(saved);

  const [values, setValues] = useState(saved);
  const [seenKey, setSeenKey] = useState(savedKey);

  // Adjusting state during render, rather than in an effect, so the corrected
  // values are what gets painted instead of a frame of the stale ones.
  if (seenKey !== savedKey) {
    setSeenKey(savedKey);
    setValues(saved);
  }

  function set<K extends keyof T>(key: K) {
    return (value: T[K]) => setValues((current) => ({ ...current, [key]: value }));
  }

  return {
    values,
    setValues,
    set,
    dirty: savedKey !== JSON.stringify(values),
  };
}
