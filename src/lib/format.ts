const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

/**
 * Discogs stores user-entered comments/notes with HTML entities encoded.
 * We only decode entities into plain text. We never render the string as
 * HTML, since it originates from untrusted (seller-entered) content.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/**
 * The line under a shop's name: how many records it has, and when they last
 * came from Discogs.
 *
 * Defined once because the storefront header and the dashboard previews both
 * show it, and a preview that words it differently from the real page is worse
 * than no preview at all.
 */
export function storeMeta(itemCount: number, lastSyncAt: Date | null): string {
  const records = `${itemCount.toLocaleString()} record${itemCount === 1 ? "" : "s"}`;
  return lastSyncAt ? `${records} · updated ${formatRelativeTime(lastSyncAt)}` : records;
}

export function formatPrice(price: number | null, currency: string | null): string {
  if (price == null) return "Price on Discogs";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
    }).format(price);
  } catch {
    return `${currency ?? ""} ${price.toFixed(2)}`.trim();
  }
}
