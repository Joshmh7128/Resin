import type { StoreLinkKind } from "@/lib/store-links";

/**
 * A small glyph beside each link.
 *
 * Drawn inline rather than pulled from an icon package: there are five of them,
 * they never change, and a storefront on a phone shouldn't wait on a font or a
 * sprite sheet to render its header. They inherit `currentColor`, so they work
 * on every theme without a per-theme variant.
 */
export function StoreLinkIcon({ kind, className = "h-3.5 w-3.5" }: {
  kind: StoreLinkKind;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 16 16",
    "aria-hidden": true as const,
    className,
  };

  if (kind === "instagram") {
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="2.2" y="2.2" width="11.6" height="11.6" rx="3.6" />
        <circle cx="8" cy="8" r="2.9" />
        <circle cx="11.5" cy="4.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (kind === "facebook") {
    return (
      <svg {...common} fill="currentColor">
        <path d="M9.4 14.5V8.6h1.9l.3-2.3H9.4V4.9c0-.65.2-1.1 1.15-1.1h1.2V1.7A16 16 0 0 0 10 1.6c-1.75 0-2.95 1.05-2.95 3.05v1.65H5.1v2.3h1.95v5.9z" />
      </svg>
    );
  }

  if (kind === "bandcamp") {
    // Bandcamp's mark is a single slanted block.
    return (
      <svg {...common} fill="currentColor">
        <path d="M2 11.4 5.6 4.6H14l-3.6 6.8z" />
      </svg>
    );
  }

  if (kind === "other") {
    // A link glyph: two joined chain segments.
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M6.6 9.4a2.6 2.6 0 0 0 3.9.3l1.9-1.9a2.6 2.6 0 0 0-3.7-3.7l-1.1 1.1" />
        <path d="M9.4 6.6a2.6 2.6 0 0 0-3.9-.3L3.6 8.2a2.6 2.6 0 0 0 3.7 3.7l1.1-1.1" />
      </svg>
    );
  }

  // Website: a globe.
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2c1.6 1.7 2.4 3.7 2.4 6S9.6 12.3 8 14c-1.6-1.7-2.4-3.7-2.4-6S6.4 3.7 8 2Z" />
    </svg>
  );
}
