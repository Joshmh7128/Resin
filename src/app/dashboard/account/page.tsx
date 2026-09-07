import { prisma } from "@/lib/prisma";
import { requireStore } from "@/lib/auth";
import { changeEmailAction, resetInventoryAction, deleteAccountAction } from "@/lib/actions";
import { PasswordForm } from "@/components/PasswordForm";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";
import { planState, planLabel } from "@/lib/plan";

export default async function AccountPage() {
  const store = await requireStore();
  const itemCount = await prisma.inventoryItem.count({ where: { storeId: store.id } });
  const state = planState(store);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Account</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Your login details, your plan, and the two buttons you hopefully never need.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Plan</h2>
        <p className="mt-1 text-sm text-neutral-600">
          You are on {state.status === "free" || state.status === "expired" ? "the free plan" : "premium"}.{" "}
          {planLabel(state)}.
        </p>
        {(state.status === "expiring" || state.status === "expired") && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {state.status === "expiring"
              ? "Your premium is nearly up. Get in touch to keep it going."
              : "Your premium has ended. Your storefront and inventory are untouched."}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Login email</h2>
        <div className="max-w-sm">
          <ActionForm action={changeEmailAction} submitLabel="Change email">
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={store.email}
                autoComplete="email"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="currentPassword" className={labelClass}>
                Current password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className={fieldClass}
              />
            </div>
          </ActionForm>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Change password</h2>
        <PasswordForm />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Reset inventory data</h2>
        <p className="mt-1 mb-4 text-sm text-neutral-600">
          Clears the {itemCount} listings Resin has cached and starts over on the next sync.
          Nothing on Discogs changes, but which items you had hidden or featured is cleared with
          them. Worth doing if your storefront has drifted out of step with Discogs.
        </p>
        <div className="max-w-sm">
          <ActionForm
            action={resetInventoryAction}
            submitLabel="Reset inventory"
            danger
            confirm="Clear all cached listings? Your hidden and featured choices go with them."
          >
            <div>
              <label htmlFor="reset-confirm" className={labelClass}>
                Type <code>{store.slug}</code> to confirm
              </label>
              <input id="reset-confirm" name="confirmation" type="text" className={fieldClass} />
            </div>
          </ActionForm>
        </div>
      </section>

      <section className="rounded-lg border border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Delete account</h2>
        <p className="mt-1 mb-4 text-sm text-neutral-600">
          Removes your store, its cached listings, and your storefront at /store/{store.slug}.
          Your Discogs listings are not touched. This cannot be undone.
        </p>
        <div className="max-w-sm">
          <ActionForm
            action={deleteAccountAction}
            submitLabel="Delete my account"
            danger
            confirm="Permanently delete this store? This cannot be undone."
          >
            <div>
              <label htmlFor="delete-password" className={labelClass}>
                Password
              </label>
              <input
                id="delete-password"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="delete-confirm" className={labelClass}>
                Type <code>{store.slug}</code> to confirm
              </label>
              <input id="delete-confirm" name="confirmation" type="text" className={fieldClass} />
            </div>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
