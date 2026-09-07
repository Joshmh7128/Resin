import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { formatRelativeTime } from "@/lib/format";
import { planState } from "@/lib/plan";
import { isLockedOut } from "@/lib/lockout";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";
import { PlanBadge, SuspendedBadge } from "@/components/admin/PlanBadge";
import {
  grantPremiumAction,
  setPremiumUntilAction,
  setLifetimePremiumAction,
  revokePremiumAction,
  adminSyncStoreAction,
  adminResetInventoryAction,
  adminDeleteStoreAction,
  adminChangeEmailAction,
  adminChangeSlugAction,
  adminSetPasswordAction,
  adminIssueResetLinkAction,
  adminToggleSuspendAction,
  adminClearLockoutAction,
  impersonateStoreAction,
} from "@/lib/admin/actions";

/** Presets for the common grants, so the usual case is one click. */
const QUICK_GRANTS = [30, 90, 365];

export default async function AdminStoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const store = await prisma.store.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });
  if (!store) notFound();

  const [visibleItems, activity, pendingReset] = await Promise.all([
    prisma.inventoryItem.count({ where: { storeId: store.id, isVisible: true } }),
    prisma.adminAuditLog.findMany({
      where: { targetStoreId: store.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.passwordResetToken.findFirst({
      where: { storeId: store.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const state = planState(store);
  const locked = isLockedOut(store);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/stores" className="text-sm text-neutral-500 hover:underline">
          ← All stores
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">{store.name}</h1>
          {store.isSuspended && <SuspendedBadge />}
          <PlanBadge store={store} />
        </div>
        <p className="mt-1 text-sm text-neutral-600">
          <Link href={`/store/${store.slug}`} target="_blank" className="underline">
            /store/{store.slug} ↗
          </Link>{" "}
          · {store.email} ·{" "}
          <a
            href={`https://www.discogs.com/user/${store.discogsUsername}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {store.discogsUsername} ↗
          </a>
        </p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Items cached" value={`${store._count.items} (${visibleItems} visible)`} />
        <Fact
          label="Last sync"
          value={store.lastSyncAt ? formatRelativeTime(store.lastSyncAt) : "Never"}
          hint={store.lastSyncStatus === "error" ? (store.lastSyncError ?? undefined) : undefined}
        />
        <Fact
          label="Last login"
          value={store.lastLoginAt ? formatRelativeTime(store.lastLoginAt) : "Never"}
        />
        <Fact label="Signed up" value={store.createdAt.toISOString().slice(0, 10)} />
      </dl>

      {store.isSuspended && store.suspendedReason && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Suspended: {store.suspendedReason}
        </p>
      )}
      {locked && store.lockedUntil && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Locked out of logging in until {store.lockedUntil.toLocaleString()} after too many
          failed attempts.
        </p>
      )}

      <Section
        title="Plan"
        description={
          state.status === "lifetime"
            ? "Premium with no end date. The expiry sweep leaves this account alone."
            : state.status === "free"
              ? "On the free plan."
              : `Premium end date: ${store.premiumUntil?.toISOString().slice(0, 10)}.`
        }
      >
        {store.planNote && (
          <p className="mb-4 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            Note: {store.planNote}
          </p>
        )}

        <div className="flex flex-wrap items-start gap-3">
          {QUICK_GRANTS.map((days) => (
            <ActionForm key={days} action={grantPremiumAction} submitLabel={`+${days} days`}>
              <input type="hidden" name="storeId" value={store.id} />
              <input type="hidden" name="days" value={days} />
            </ActionForm>
          ))}
        </div>

        <p className="mt-2 text-xs text-neutral-500">
          Days are added to the end of any period still running, so renewing early never costs
          the store the time it already has. A lapsed store starts again from today.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Add time</h3>
            <ActionForm action={grantPremiumAction} submitLabel="Add days">
              <input type="hidden" name="storeId" value={store.id} />
              <div>
                <label htmlFor="days" className={labelClass}>
                  Days
                </label>
                <input
                  id="days"
                  name="days"
                  type="number"
                  min={1}
                  max={3650}
                  defaultValue={30}
                  required
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="grant-note" className={labelClass}>
                  Note (optional)
                </label>
                <input
                  id="grant-note"
                  name="note"
                  type="text"
                  maxLength={500}
                  placeholder="Invoice 1043, paid by transfer"
                  className={fieldClass}
                />
              </div>
            </ActionForm>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Set the end date</h3>
            <ActionForm action={setPremiumUntilAction} submitLabel="Set date">
              <input type="hidden" name="storeId" value={store.id} />
              <div>
                <label htmlFor="until" className={labelClass}>
                  Premium runs to the end of
                </label>
                <input
                  id="until"
                  name="until"
                  type="date"
                  required
                  defaultValue={store.premiumUntil?.toISOString().slice(0, 10)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="until-note" className={labelClass}>
                  Note (optional)
                </label>
                <input
                  id="until-note"
                  name="note"
                  type="text"
                  maxLength={500}
                  className={fieldClass}
                />
              </div>
            </ActionForm>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-start gap-3 border-t border-neutral-100 pt-4">
          <ActionForm
            action={setLifetimePremiumAction}
            submitLabel="Premium, no expiry"
            confirm="Give this store premium with no end date?"
          >
            <input type="hidden" name="storeId" value={store.id} />
          </ActionForm>
          <ActionForm
            action={revokePremiumAction}
            submitLabel="Move to free"
            danger
            confirm="Move this store back to the free plan now?"
          >
            <input type="hidden" name="storeId" value={store.id} />
          </ActionForm>
        </div>
      </Section>

      <Section
        title="Inventory"
        description="The same sync and reset the owner has, for when they can't get to it."
      >
        <div className="flex flex-wrap items-start gap-6">
          <ActionForm action={adminSyncStoreAction} submitLabel="Sync from Discogs">
            <input type="hidden" name="storeId" value={store.id} />
          </ActionForm>

          <ActionForm
            action={adminResetInventoryAction}
            submitLabel="Reset inventory"
            danger
            confirm={`Delete all ${store._count.items} cached items for ${store.slug}?`}
          >
            <input type="hidden" name="storeId" value={store.id} />
            <div>
              <label htmlFor="reset-confirm" className={labelClass}>
                Type <code>{store.slug}</code> to confirm
              </label>
              <input id="reset-confirm" name="confirmation" type="text" className={fieldClass} />
            </div>
          </ActionForm>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Resetting clears the cached listings and this store&apos;s sync history, including which
          items were hidden or featured. Nothing on Discogs is touched; the next sync rebuilds
          the cache.
        </p>
      </Section>

      <Section title="Access" description="Sign-in details and support access.">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Login email</h3>
            <ActionForm action={adminChangeEmailAction} submitLabel="Change email">
              <input type="hidden" name="storeId" value={store.id} />
              <input
                name="email"
                type="email"
                required
                defaultValue={store.email}
                className={fieldClass}
              />
            </ActionForm>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Storefront URL</h3>
            <ActionForm
              action={adminChangeSlugAction}
              submitLabel="Change URL"
              confirm="Change the storefront URL? Any printed QR code for the old one stops working."
            >
              <input type="hidden" name="storeId" value={store.id} />
              <input
                name="slug"
                type="text"
                required
                defaultValue={store.slug}
                className={fieldClass}
              />
            </ActionForm>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Password reset link</h3>
            <p className="mb-2 text-xs text-neutral-500">
              Emails a single-use link that expires in an hour, and shows it here so you can send
              it yourself if no mail provider is set up.
              {pendingReset && (
                <>
                  {" "}
                  One is already outstanding, issued{" "}
                  {formatRelativeTime(pendingReset.createdAt)}. Issuing another replaces it.
                </>
              )}
            </p>
            <ActionForm action={adminIssueResetLinkAction} submitLabel="Issue reset link">
              <input type="hidden" name="storeId" value={store.id} />
            </ActionForm>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Set a password</h3>
            <p className="mb-2 text-xs text-neutral-500">
              Prefer the reset link: it doesn&apos;t leave you knowing the owner&apos;s password.
            </p>
            <ActionForm
              action={adminSetPasswordAction}
              submitLabel="Set password"
              confirm="Set a new password for this store?"
            >
              <input type="hidden" name="storeId" value={store.id} />
              <input
                name="newPassword"
                type="text"
                required
                minLength={8}
                autoComplete="off"
                placeholder="At least 8 characters"
                className={fieldClass}
              />
            </ActionForm>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-start gap-3 border-t border-neutral-100 pt-4">
          <ActionForm
            action={impersonateStoreAction}
            submitLabel="Open their dashboard"
            confirm="Open this store's dashboard as the owner? It is logged, and the session lasts an hour."
          >
            <input type="hidden" name="storeId" value={store.id} />
          </ActionForm>
          {locked && (
            <ActionForm action={adminClearLockoutAction} submitLabel="Clear login lockout">
              <input type="hidden" name="storeId" value={store.id} />
            </ActionForm>
          )}
        </div>
      </Section>

      <Section
        title="Suspend or delete"
        description="Suspending is reversible and leaves everything in place. Deleting is not."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">
              {store.isSuspended ? "Restore access" : "Suspend"}
            </h3>
            <ActionForm
              action={adminToggleSuspendAction}
              submitLabel={store.isSuspended ? "Restore access" : "Suspend account"}
              danger={!store.isSuspended}
              confirm={
                store.isSuspended
                  ? undefined
                  : "Suspend this store? The owner can't log in and their storefront will 404."
              }
            >
              <input type="hidden" name="storeId" value={store.id} />
              {!store.isSuspended && (
                <div>
                  <label htmlFor="reason" className={labelClass}>
                    Reason (shown to the owner)
                  </label>
                  <input
                    id="reason"
                    name="reason"
                    type="text"
                    maxLength={500}
                    className={fieldClass}
                  />
                </div>
              )}
            </ActionForm>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Delete account</h3>
            <p className="mb-2 text-xs text-neutral-500">
              Removes the store, its {store._count.items} cached items, and its storefront. The
              audit log keeps a record that it happened.
            </p>
            <ActionForm
              action={adminDeleteStoreAction}
              submitLabel="Delete account"
              danger
              confirm={`Permanently delete ${store.slug}? This cannot be undone.`}
            >
              <input type="hidden" name="storeId" value={store.id} />
              <div>
                <label htmlFor="delete-confirm" className={labelClass}>
                  Type <code>{store.slug}</code> to confirm
                </label>
                <input id="delete-confirm" name="confirmation" type="text" className={fieldClass} />
              </div>
            </ActionForm>
          </div>
        </div>
      </Section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">History</h2>
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
          {activity.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-500">Nothing logged for this store.</li>
          )}
          {activity.map((entry) => (
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

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-neutral-900">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-red-600">{hint}</dd>}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-neutral-600">{description}</p>
      {children}
    </section>
  );
}
