import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatRelativeTime } from "@/lib/format";
import { SearchForm } from "@/components/SearchForm";
import { Pagination } from "@/components/Pagination";
import { SortSelect } from "@/components/SortSelect";
import { ItemImage } from "@/components/ItemImage";
import type { Prisma } from "@prisma/client";

const SORT_OPTIONS = {
  // Ordered by when we first saw the listing, not `updatedAt`. Caching an
  // item's cover art counts as an update, so ordering by `updatedAt` made the
  // grid reshuffle under the customer as artwork loaded in.
  newest: { label: "Recently listed", orderBy: { createdAt: "desc" } },
  price_asc: { label: "Price: low to high", orderBy: { price: "asc" } },
  price_desc: { label: "Price: high to low", orderBy: { price: "desc" } },
  title_asc: { label: "Title: A–Z", orderBy: { title: "asc" } },
} as const satisfies Record<string, { label: string; orderBy: Prisma.InventoryItemOrderByWithRelationInput }>;

type SortKey = keyof typeof SORT_OPTIONS;

function isSortKey(value: string | undefined): value is SortKey {
  return Boolean(value && value in SORT_OPTIONS);
}

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) notFound();

  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : "newest";
  const pageSize = store.itemsPerPage;

  const where = {
    storeId: store.id,
    isVisible: true,
    ...(q ? { searchText: { contains: q.toLowerCase() } } : {}),
  };

  const [total, featuredItems, items] = await Promise.all([
    prisma.inventoryItem.count({ where }),
    page === 1 && !q
      ? prisma.inventoryItem.findMany({
          where: { storeId: store.id, isVisible: true, isFeatured: true },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : Promise.resolve([]),
    prisma.inventoryItem.findMany({
      where,
      orderBy: SORT_OPTIONS[sort].orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div
          className="h-1.5 w-full"
          style={{ backgroundColor: store.accentColor }}
          aria-hidden
        />
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="text-3xl font-bold text-neutral-900">{store.name}</h1>
          {store.description && (
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">{store.description}</p>
          )}
          <p className="mt-2 text-xs text-neutral-400">
            Inventory synced from{" "}
            <a
              href={`https://www.discogs.com/user/${store.discogsUsername}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Discogs
            </a>
            {store.lastSyncAt && <> · updated {formatRelativeTime(store.lastSyncAt)}</>}
          </p>
          {store.lastSyncAt && (
            <p className="mt-1 text-xs text-neutral-400">
              Don&apos;t see what you&apos;re looking for? Ask a staff member to sync our
              inventory.
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {featuredItems.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Featured</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
              {featuredItems.map((item) => (
                <ItemCard key={item.id} slug={slug} item={item} compact />
              ))}
            </div>
          </section>
        )}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchForm action={`/store/${slug}`} defaultValue={q} />
          <SortSelect slug={slug} q={q} sort={sort} />
        </div>

        <p className="mb-4 text-sm text-neutral-500">
          {total} item{total === 1 ? "" : "s"} for sale
        </p>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-12 text-center text-neutral-500">
            {q ? "No items match your search." : "This store hasn't listed any items yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item) => (
              <ItemCard key={item.id} slug={slug} item={item} />
            ))}
          </div>
        )}

        <Pagination
          basePath={`/store/${slug}`}
          params={{ q, sort }}
          page={page}
          totalPages={totalPages}
        />
      </main>
    </div>
  );
}

function ItemCard({
  slug,
  item,
  compact,
}: {
  slug: string;
  item: {
    id: string;
    title: string;
    artist: string;
    price: number | null;
    priceCurrency: string | null;
    condition: string | null;
    thumbUrl: string | null;
    imageUrl: string | null;
  };
  compact?: boolean;
}) {
  const image = item.thumbUrl ?? item.imageUrl;
  return (
    <Link
      href={`/store/${slug}/item/${item.id}`}
      className="group overflow-hidden rounded-lg border border-neutral-200 bg-white transition hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-neutral-100">
        <ItemImage
          itemId={item.id}
          cachedUrl={image}
          alt={`${item.artist} - ${item.title}`}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </div>
      <div className={compact ? "p-2" : "p-3"}>
        <p className="truncate text-sm font-medium text-neutral-900">{item.title}</p>
        <p className="truncate text-xs text-neutral-500">{item.artist}</p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-900">
            {formatPrice(item.price, item.priceCurrency)}
          </span>
          {item.condition && !compact && (
            <span className="text-xs text-neutral-400">{item.condition}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
