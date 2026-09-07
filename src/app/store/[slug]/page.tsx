import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { storeMetadata } from "@/lib/metadata";
import { getStoreFacets } from "@/lib/facets";
import { resolvePresentation } from "@/lib/theme";
import {
  PARAM,
  SORT_OPTIONS,
  buildWhere,
  clearFiltersHref,
  hasActiveFilters,
  pageHref,
  parseStorefrontQuery,
} from "@/lib/storefront-query";
import { StoreHeader } from "@/components/StoreHeader";
import { StorefrontFrame } from "@/components/StorefrontFrame";
import { FeaturedSection } from "@/components/FeaturedSection";
import { FilterPanel, ActiveFilterChips } from "@/components/FilterPanel";
import { BrowseControls } from "@/components/BrowseControls";
import { CoverFlow } from "@/components/CoverFlow";
import { RecordCard, RecordRow, type StorefrontItem } from "@/components/RecordCard";
import { SearchForm } from "@/components/SearchForm";
import { Pagination } from "@/components/Pagination";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return storeMetadata(slug);
}

/** The columns every layout draws from. Selected explicitly so a wide row (rawData, searchText) never crosses the wire. */
const ITEM_FIELDS = {
  id: true,
  title: true,
  artist: true,
  label: true,
  year: true,
  format: true,
  price: true,
  priceCurrency: true,
  condition: true,
  thumbUrl: true,
  imageUrl: true,
} as const;

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const store = await prisma.store.findUnique({
    where: { slug },
    include: { locations: { orderBy: { sortOrder: "asc" } } },
  });
  if (!store) notFound();

  const presentation = resolvePresentation(store);
  const basePath = `/store/${slug}`;
  const query = parseStorefrontQuery(sp, presentation.defaultLayout);
  const pageSize = store.itemsPerPage;

  const where = buildWhere(store.id, query);
  const filtered = hasActiveFilters(query) || Boolean(query.q);

  const [total, catalogueTotal, featuredItems, items, facets] = await Promise.all([
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.count({ where: { storeId: store.id, isVisible: true } }),
    // Featured picks are the shop's own shelf, so they stay put rather than
    // being re-filtered: once someone is searching or filtering, they want
    // their results, not the shop's suggestions.
    query.page === 1 && !filtered
      ? prisma.inventoryItem.findMany({
          where: { storeId: store.id, isVisible: true, isFeatured: true },
          orderBy: { createdAt: "desc" },
          take: 12,
          select: ITEM_FIELDS,
        })
      : Promise.resolve([]),
    prisma.inventoryItem.findMany({
      where,
      orderBy: SORT_OPTIONS[query.sort].orderBy,
      skip: (query.page - 1) * pageSize,
      take: pageSize,
      select: ITEM_FIELDS,
    }),
    getStoreFacets(store.id, store.lastSyncAt?.getTime() ?? 0),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <StorefrontFrame presentation={presentation}>
      <StoreHeader store={store} itemCount={catalogueTotal} presentation={presentation} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <FeaturedSection
          slug={slug}
          items={featuredItems}
          layout={presentation.featuredLayout}
        />

        {/*
          Sticky so search, filters and sort stay reachable while scrolling a
          long catalogue, which on a phone is the whole point.

          It stops being sticky while the filter panel is open, though. A sticky
          element taller than the viewport pins its top and leaves everything
          past the fold unreachable: on a phone the lower filter groups and the
          Apply button ran off the bottom of the screen with no way to scroll to
          them. Going static while open lets the panel expand in normal flow and
          the page scroll the way it would anywhere else, with no scroll area
          nested inside another.

          `has-[details[open]]` reads the panel's own open state, so this needs
          no JavaScript and works before hydration, like the panel itself. The
          height cap is the fallback for a browser without `:has()`: the bar
          scrolls within itself instead, which is worse to use but still reaches
          every filter. `dvh` accounts for a phone's moving browser chrome.
        */}
        <div className="sticky top-0 z-20 -mx-4 mb-5 max-h-dvh overflow-y-auto overscroll-contain border-b border-st-border bg-st-bg/90 px-4 py-3 backdrop-blur has-[details[open]]:static has-[details[open]]:max-h-none has-[details[open]]:overflow-visible sm:-mx-6 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchForm
              action={basePath}
              defaultValue={query.q}
              themed
              hidden={{
                [PARAM.sort]: query.sort !== "newest" ? query.sort : undefined,
                [PARAM.layout]:
                  query.layout !== presentation.defaultLayout ? query.layout : undefined,
              }}
            />
            <BrowseControls
              basePath={basePath}
              query={query}
              defaultLayout={presentation.defaultLayout}
            />
          </div>

          <div className="mt-3">
            <FilterPanel
              basePath={basePath}
              query={query}
              facets={facets}
              defaultLayout={presentation.defaultLayout}
              currency={store.currency}
            />
            <ActiveFilterChips
              basePath={basePath}
              query={query}
              defaultLayout={presentation.defaultLayout}
            />
          </div>

          <p className="mt-3 text-sm text-st-muted">
            <span className="font-medium text-st-fg">{total.toLocaleString()}</span>{" "}
            {query.q ? (
              <>
                result{total === 1 ? "" : "s"} for &ldquo;{query.q}&rdquo;
              </>
            ) : filtered ? (
              <>record{total === 1 ? "" : "s"} match these filters</>
            ) : (
              <>record{total === 1 ? "" : "s"} for sale</>
            )}
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState
            basePath={basePath}
            searching={Boolean(query.q)}
            filtered={filtered}
            clearHref={clearFiltersHref(basePath, query, presentation.defaultLayout)}
          />
        ) : (
          <Results slug={slug} items={items} layout={query.layout} />
        )}

        <Pagination
          themed
          page={query.page}
          totalPages={totalPages}
          hrefFor={(target) => pageHref(basePath, query, presentation.defaultLayout, target)}
        />
      </main>
    </StorefrontFrame>
  );
}

function Results({
  slug,
  items,
  layout,
}: {
  slug: string;
  items: StorefrontItem[];
  layout: "grid" | "list" | "coverflow";
}) {
  if (layout === "coverflow") {
    return <CoverFlow slug={slug} items={items} />;
  }

  if (layout === "list") {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <RecordRow key={item.id} slug={slug} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4">
      {items.map((item) => (
        <RecordCard key={item.id} slug={slug} item={item} />
      ))}
    </div>
  );
}

function EmptyState({
  basePath,
  searching,
  filtered,
  clearHref,
}: {
  basePath: string;
  searching: boolean;
  filtered: boolean;
  clearHref: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-st-border bg-st-surface p-10 text-center sm:p-16">
      <p className="text-base font-medium text-st-fg">
        {filtered ? "Nothing matched that" : "No records listed yet"}
      </p>
      <p className="mt-2 text-sm text-st-muted">
        {filtered ? (
          <>
            {searching
              ? "Try a different artist, title or catalogue number, or "
              : "Try loosening a filter, or "}
            <Link href={clearHref} className="underline">
              clear the filters
            </Link>{" "}
            and{" "}
            <Link href={basePath} className="underline">
              browse everything
            </Link>
            .
          </>
        ) : (
          "Check back soon."
        )}
      </p>
    </div>
  );
}
