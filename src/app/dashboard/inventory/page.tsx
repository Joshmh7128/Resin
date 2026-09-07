import { requireStore } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SearchForm } from "@/components/SearchForm";
import { Pagination } from "@/components/Pagination";
import { InventoryTable } from "@/components/InventoryTable";

const PAGE_SIZE = 25;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const store = await requireStore();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const where = {
    storeId: store.id,
    ...(q ? { searchText: { contains: q.toLowerCase() } } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.inventoryItem.count({ where }),
    prisma.inventoryItem.findMany({
      where,
      // Stable ordering: `updatedAt` shifts whenever cover art is cached, which
      // made rows jump around while a warm was running.
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        artist: true,
        condition: true,
        price: true,
        priceCurrency: true,
        imageUrl: true,
        thumbUrl: true,
        isVisible: true,
        isFeatured: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Inventory</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {total.toLocaleString()} item{total === 1 ? "" : "s"} synced from Discogs. Tick
          items to change several at once, or use the toggles to hide something or feature
          your best finds.
        </p>
      </div>

      <SearchForm action="/dashboard/inventory" defaultValue={q} />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          {total === 0
            ? "No inventory yet. Run a sync from the Overview page to pull your Discogs listings."
            : "No items match your search."}
        </p>
      ) : (
        <InventoryTable items={items} />
      )}

      <Pagination
        basePath="/dashboard/inventory"
        params={{ q }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
