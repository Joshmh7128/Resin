import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { ItemImage } from "@/components/ItemImage";

/** The fields every storefront layout needs. Kept in one place so the grid, list and cover flow stay in step. */
export interface StorefrontItem {
  id: string;
  title: string;
  artist: string;
  label: string | null;
  year: number | null;
  format: string | null;
  price: number | null;
  priceCurrency: string | null;
  condition: string | null;
  thumbUrl: string | null;
  imageUrl: string | null;
}

export function coverAlt(item: StorefrontItem) {
  return `${item.artist} - ${item.title}`;
}

export function Cover({
  item,
  className = "h-full w-full object-cover",
}: {
  item: StorefrontItem;
  className?: string;
}) {
  return (
    <ItemImage
      itemId={item.id}
      cachedUrl={item.thumbUrl ?? item.imageUrl}
      alt={coverAlt(item)}
      className={className}
    />
  );
}

/** A cover with title, artist and price underneath. Used by the grid and the featured rail. */
export function RecordCard({
  slug,
  item,
  compact,
}: {
  slug: string;
  item: StorefrontItem;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/store/${slug}/item/${item.id}`}
      className="group overflow-hidden rounded-lg border border-st-border bg-st-surface transition hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-st-surface-2">
        <Cover item={item} className="h-full w-full object-cover transition group-hover:scale-105" />
      </div>
      <div className={compact ? "p-2" : "p-3"}>
        <p className="truncate text-sm font-medium text-st-fg">{item.title}</p>
        <p className="truncate text-xs text-st-muted">{item.artist}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-st-fg">
            {formatPrice(item.price, item.priceCurrency)}
          </span>
          {item.condition && !compact && (
            <span className="truncate text-xs text-st-faint">{item.condition}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * One record per row. Fits more of the detail a buyer actually decides on
 * (label, year, format, condition) than a grid tile has room for.
 */
export function RecordRow({ slug, item }: { slug: string; item: StorefrontItem }) {
  const details = [item.label, item.year?.toString(), item.format]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/store/${slug}/item/${item.id}`}
      className="flex items-center gap-3 rounded-lg border border-st-border bg-st-surface p-2.5 transition hover:shadow-md sm:gap-4 sm:p-3"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-st-surface-2 sm:h-20 sm:w-20">
        <Cover item={item} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-st-fg">{item.title}</p>
        <p className="truncate text-sm text-st-muted">{item.artist}</p>
        {details && <p className="mt-0.5 truncate text-xs text-st-faint">{details}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-st-fg">
          {formatPrice(item.price, item.priceCurrency)}
        </p>
        {item.condition && <p className="text-xs text-st-faint">{item.condition}</p>}
      </div>
    </Link>
  );
}
