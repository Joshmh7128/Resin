import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { runPremiumMaintenanceAction } from "@/lib/admin/actions";
import { planFilter, EXPIRING_SOON_DAYS } from "@/lib/plan";
import { formatRelativeTime } from "@/lib/format";
import { ActionForm } from "@/components/ActionForm";
import { PlanBadge, SuspendedBadge } from "@/components/admin/PlanBadge";
import { isMailConfigured } from "@/lib/mailer";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalStores,
    premiumCount,
    expiringCount,
    lapsedCount,
    suspendedCount,
    newThisMonth,
    totalItems,
    expiring,
    lapsed,
    syncErrors,
    recentSignups,
    recentActivity,
  ] = await Promise.all([
    prisma.store.count(),
    prisma.store.count({ where: planFilter("premium", now) }),
    prisma.store.count({ where: planFilter("expiring", now) }),
    prisma.store.count({ where: planFilter("expired", now) }),
    prisma.store.count({ where: planFilter("suspended", now) }),
    prisma.store.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.inventoryItem.count(),
    prisma.store.findMany({
      where: planFilter("expiring", now),
      orderBy: { premiumUntil: "asc" },
      take: 10,
    }),
    prisma.store.findMany({
      where: planFilter("expired", now),
      orderBy: { premiumUntil: "desc" },
      take: 10,
    }),
    prisma.store.findMany({
      where: { lastSyncStatus: "error" },
      orderBy: { lastSyncAt: "desc" },
      take: 10,
    }),
    prisma.store.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Overview</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Who is paid up, what needs looking at, and what has been done lately.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Stores" value={totalStores} href="/admin/stores" />
        <Stat label="Premium" value={premiumCount} href="/admin/stores?plan=premium" />
        <Stat
          label={`Ending in ${EXPIRING_SOON_DAYS}d`}
          value={expiringCount}
          href="/admin/stores?plan=expiring"
          tone={expiringCount > 0 ? "amber" : undefined}
        />
        <Stat
          label="Lapsed"
          value={lapsedCount}
          href="/admin/stores?plan=expired"
          tone={lapsedCount > 0 ? "red" : undefined}
        />
        <Stat label="Suspended" value={suspendedCount} href="/admin/stores?plan=suspended" />
        <Stat label="New in 30d" value={newThisMonth} />
      </div>

      <p className="text-sm text-neutral-500">
        {totalItems.toLocaleString()} inventory items cached across all stores.
        {!isMailConfigured() && (
          <>
            {" "}
            No mail provider is configured, so password resets and expiry notices are written to
            the server log instead of being sent. Set <code>RESEND_API_KEY</code> and{" "}
            <code>MAIL_FROM</code> to turn them on.
          </>
        )}
      </p>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Plan expiry</h2>
        <p className="mt-1 mb-4 text-sm text-neutral-600">
          Premium ends on its own the moment its date passes, whether or not this has run. The
          sweep is what sends the warning emails, moves lapsed stores back to the free plan, and
          writes the audit entry. Point a scheduler at{" "}
          <code>POST /api/admin/premium-expiry</code> to run it nightly.
        </p>
        <ActionForm
          action={runPremiumMaintenanceAction}
          submitLabel="Run the sweep now"
          pendingLabel="Running…"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <StoreList
          title={`Premium ending within ${EXPIRING_SOON_DAYS} days`}
          empty="Nobody is close to running out."
          stores={expiring}
        />
        <StoreList
          title="Lapsed"
          empty="No lapsed accounts."
          stores={lapsed}
        />
        <StoreList
          title="Failing syncs"
          empty="Every store's last sync succeeded."
          stores={syncErrors}
          detail={(store) => store.lastSyncError ?? undefined}
        />
        <StoreList
          title="Newest signups"
          empty="No stores yet."
          stores={recentSignups}
          detail={(store) => `Signed up ${formatRelativeTime(store.createdAt)}`}
        />
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Recent activity</h2>
          <Link href="/admin/audit" className="text-sm text-neutral-600 underline">
            Full audit log
          </Link>
        </div>
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {recentActivity.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-500">Nothing logged yet.</li>
          )}
          {recentActivity.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-neutral-800">{entry.summary}</span>
              <span className="shrink-0 text-neutral-400">
                {entry.adminEmail} · {formatRelativeTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "amber" | "red";
}) {
  const toneClass =
    tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-700" : "text-neutral-900";

  const body = (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );

  return href ? (
    <Link href={href} className="block hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

interface ListedStore {
  id: string;
  name: string;
  slug: string;
  plan: string;
  premiumUntil: Date | null;
  isSuspended: boolean;
  createdAt: Date;
  lastSyncError: string | null;
}

function StoreList({
  title,
  empty,
  stores,
  detail,
}: {
  title: string;
  empty: string;
  stores: ListedStore[];
  detail?: (store: ListedStore) => string | undefined;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">{title}</h2>
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {stores.length === 0 && <li className="px-4 py-3 text-sm text-neutral-500">{empty}</li>}
        {stores.map((store) => {
          const line = detail?.(store);
          return (
            <li key={store.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/admin/stores/${store.id}`} className="font-medium hover:underline">
                  {store.name}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  {store.isSuspended && <SuspendedBadge />}
                  <PlanBadge store={store} />
                </span>
              </div>
              {line && <p className="mt-0.5 truncate text-xs text-neutral-500">{line}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
