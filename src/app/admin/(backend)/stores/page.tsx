import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { planFilter, isPlanFilterKey, type PlanFilterKey } from "@/lib/plan";
import { formatRelativeTime } from "@/lib/format";
import { Pagination } from "@/components/Pagination";
import { PlanBadge, SuspendedBadge } from "@/components/admin/PlanBadge";

const PAGE_SIZE = 25;

const TABS: { key: PlanFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "premium", label: "Premium" },
  { key: "expiring", label: "Ending soon" },
  { key: "expired", label: "Lapsed" },
  { key: "never_paid", label: "Never paid" },
  { key: "suspended", label: "Suspended" },
];

const SORTS = {
  newest: { label: "Newest signup", orderBy: { createdAt: "desc" } },
  name: { label: "Name", orderBy: { name: "asc" } },
  // Nulls (lifetime and free) sort last, so the dates you care about lead.
  premium: { label: "Premium end date", orderBy: { premiumUntil: { sort: "asc", nulls: "last" } } },
  synced: { label: "Last synced", orderBy: { lastSyncAt: { sort: "desc", nulls: "last" } } },
} as const satisfies Record<string, { label: string; orderBy: Prisma.StoreOrderByWithRelationInput }>;

type SortKey = keyof typeof SORTS;

function isSortKey(value: string | undefined): value is SortKey {
  return Boolean(value && value in SORTS);
}

export default async function AdminStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; page?: string; sort?: string; deleted?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const plan: PlanFilterKey = isPlanFilterKey(sp.plan) ? sp.plan : "all";
  const sort: SortKey = isSortKey(sp.sort) ? sp.sort : "newest";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.StoreWhereInput = {
    ...planFilter(plan),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { slug: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { discogsUsername: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, stores] = await Promise.all([
    prisma.store.count({ where }),
    prisma.store.findMany({
      where,
      orderBy: SORTS[sort].orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { items: true } } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Stores</h1>
        <p className="text-sm text-neutral-500">{total} matching</p>
      </div>

      {sp.deleted === "1" && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Account deleted.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const search = new URLSearchParams();
          if (tab.key !== "all") search.set("plan", tab.key);
          if (q) search.set("q", q);
          if (sort !== "newest") search.set("sort", sort);
          const href = search.toString() ? `/admin/stores?${search}` : "/admin/stores";
          return (
            <Link
              key={tab.key}
              href={href}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                plan === tab.key
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <form method="GET" action="/admin/stores" className="flex flex-wrap gap-2">
        {plan !== "all" && <input type="hidden" name="plan" value={plan} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Name, URL, email, or Discogs username"
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          {Object.entries(SORTS).map(([key, option]) => (
            <option key={key} value={key}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs tracking-wide text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Store</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Last sync</th>
              <th className="px-4 py-3 font-medium">Signed up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {stores.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No stores match.
                </td>
              </tr>
            )}
            {stores.map((store) => (
              <tr key={store.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/stores/${store.id}`}
                    className="font-medium text-neutral-900 hover:underline"
                  >
                    {store.name}
                  </Link>
                  <p className="text-xs text-neutral-500">
                    /store/{store.slug} · {store.email}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap items-center gap-1">
                    {store.isSuspended && <SuspendedBadge />}
                    <PlanBadge store={store} />
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-700">{store._count.items}</td>
                <td className="px-4 py-3 text-neutral-700">
                  {store.lastSyncAt ? formatRelativeTime(store.lastSyncAt) : "Never"}
                  {store.lastSyncStatus === "error" && (
                    <span className="ml-1 text-xs text-red-600">failed</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {formatRelativeTime(store.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath="/admin/stores"
        params={{ q, plan: plan === "all" ? undefined : plan, sort }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
