import { requireStore } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime } from "@/lib/format";
import { SyncButton } from "@/components/SyncButton";
import { StoreQrCode } from "@/components/StoreQrCode";
import { getSyncStatusAction } from "@/lib/actions";

export default async function DashboardPage() {
  const store = await requireStore();
  const [itemCount, visibleCount, syncStatus] = await Promise.all([
    prisma.inventoryItem.count({ where: { storeId: store.id } }),
    prisma.inventoryItem.count({ where: { storeId: store.id, isVisible: true } }),
    getSyncStatusAction(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Welcome back, {store.name}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Discogs seller:{" "}
          <a
            href={`https://www.discogs.com/user/${store.discogsUsername}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {store.discogsUsername}
          </a>
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <StatCard label="Total listings" value={itemCount} />
        <StatCard label="Visible on storefront" value={visibleCount} />
        <StatCard
          label="Last synced"
          value={store.lastSyncAt ? formatRelativeTime(store.lastSyncAt) : "Never"}
          hint={store.lastSyncAt ? store.lastSyncAt.toLocaleString() : undefined}
          small
        />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Sync inventory</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Pull the latest listings from your Discogs seller account. Items no longer for sale on
          Discogs are removed automatically.
        </p>
        <p className="mt-1 text-sm text-neutral-500">
          Customers see the last-synced time on your storefront and are told to ask a staff
          member to sync if they can&apos;t find something. Keep it current with a quick sync
          during a slow moment.
        </p>
        {store.lastSyncStatus === "error" && store.lastSyncError && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Last sync failed: {store.lastSyncError}
          </p>
        )}
        <div className="mt-4">
          <SyncButton initialStatus={syncStatus} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Your storefront QR code</h2>
        <p className="mb-4 text-sm text-neutral-600">
          Print this and put it on the counter or in crates. Customers scan it to browse your
          inventory on their phone.
        </p>
        <StoreQrCode slug={store.slug} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  small,
}: {
  label: string;
  value: string | number;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className={`mt-1 font-bold text-neutral-900 ${small ? "text-base" : "text-3xl"}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}
