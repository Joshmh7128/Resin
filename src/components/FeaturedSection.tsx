import { FeaturedRail } from "@/components/FeaturedRail";
import { RecordCard, RecordRow, type StorefrontItem } from "@/components/RecordCard";
import type { FeaturedLayoutId } from "@/lib/theme";

/**
 * The shop's featured picks, laid out the way the shop chose.
 *
 * Carousel is the default because it keeps the picks to a single line on a
 * phone, where a grid of six would push the catalogue itself off the screen.
 * Shops that would rather show everything at once can switch to a grid or list.
 */
export function FeaturedSection({
  slug,
  items,
  layout,
}: {
  slug: string;
  items: StorefrontItem[];
  layout: FeaturedLayoutId;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8 sm:mb-12">
      <div className="mb-3 flex items-baseline gap-3 sm:mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-st-fg sm:text-xl">Featured</h2>
        <span className="h-px flex-1 bg-st-accent opacity-25" aria-hidden />
      </div>

      {layout === "carousel" && (
        <FeaturedRail label="Featured records">
          {items.map((item) => (
            <div key={item.id} className="w-36 shrink-0 snap-start sm:w-44">
              <RecordCard slug={slug} item={item} compact />
            </div>
          ))}
        </FeaturedRail>
      )}

      {layout === "grid" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-6">
          {items.map((item) => (
            <RecordCard key={item.id} slug={slug} item={item} compact />
          ))}
        </div>
      )}

      {layout === "list" && (
        <div className="space-y-2">
          {items.map((item) => (
            <RecordRow key={item.id} slug={slug} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
