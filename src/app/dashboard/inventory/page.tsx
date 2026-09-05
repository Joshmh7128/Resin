import Image from "next/image";
import { requireStore } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { SearchForm } from "@/components/SearchForm";
import { Pagination } from "@/components/Pagination";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { toggleItemVisibilityAction, toggleItemFeaturedAction } from "@/lib/actions";

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
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Inventory</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {total} item{total === 1 ? "" : "s"} synced from Discogs. Hide items you don&apos;t
          want shown, or feature your best finds.
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
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Visible</th>
                <th className="px-4 py-3">Featured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="flex items-center gap-3 px-4 py-3">
                    {item.thumbUrl ?? item.imageUrl ? (
                      <Image
                        src={(item.thumbUrl ?? item.imageUrl)!}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-neutral-100" />
                    )}
                    <div>
                      <p className="font-medium text-neutral-900">{item.title}</p>
                      <p className="text-neutral-500">{item.artist}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{item.condition ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatPrice(item.price, item.priceCurrency)}
                  </td>
                  <td className="px-4 py-3">
                    <ToggleSwitch
                      id={item.id}
                      active={item.isVisible}
                      action={toggleItemVisibilityAction}
                      labelOn="Visible"
                      labelOff="Hidden"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <ToggleSwitch
                      id={item.id}
                      active={item.isFeatured}
                      action={toggleItemFeaturedAction}
                      labelOn="Featured"
                      labelOff="Not featured"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
