/**
 * Caps how many cover-image requests are in flight from one page at a time.
 *
 * Discogs is throttled to roughly one request every 2.6s process-wide, so
 * requests queue on the server. If a page fired all 24 of its images at once,
 * the last would sit open for a minute and be killed by the platform's request
 * timeout. Holding a few at a time keeps every individual request short, and
 * the rest simply wait their turn on the client.
 */
const MAX_CONCURRENT = 3;

let active = 0;
const waiting: Array<() => void> = [];

export async function withImageSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    // Wait for a slot to be handed over directly by a finishing request.
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    active += 1;
  }

  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) {
      // Hand our slot straight to the next waiter; `active` is unchanged.
      next();
    } else {
      active -= 1;
    }
  }
}

/** Exposed for tests. */
export function __getQueueState() {
  return { active, waiting: waiting.length };
}
