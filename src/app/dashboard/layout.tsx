import Link from "next/link";
import { requireStoreSession } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import { stopImpersonatingAction } from "@/lib/admin/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { store, impersonatedBy } = await requireStoreSession();

  return (
    <div className="flex min-h-screen flex-col">
      {impersonatedBy && (
        // Loud on purpose: anything done from here is done as the owner, and
        // an admin who forgets which session they are in could change a real
        // store's settings by accident.
        <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-6 py-2 text-sm font-medium text-amber-950">
          <span>
            You are viewing {store.name} as its owner, signed in as {impersonatedBy.email}.
          </span>
          <form action={stopImpersonatingAction}>
            <button type="submit" className="rounded-md bg-amber-950 px-3 py-1 text-white">
              Back to admin
            </button>
          </form>
        </div>
      )}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Resin
            </Link>
            {/* Wraps rather than overlapping the sign-out controls on a phone. */}
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-neutral-600">
              <Link href="/dashboard" className="hover:text-neutral-900">
                Overview
              </Link>
              <Link href="/dashboard/inventory" className="hover:text-neutral-900">
                Inventory
              </Link>
              <Link href="/dashboard/settings" className="hover:text-neutral-900">
                Settings
              </Link>
              <Link href="/dashboard/account" className="hover:text-neutral-900">
                Account
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href={`/store/${store.slug}`}
              target="_blank"
              className="text-neutral-600 hover:text-neutral-900"
            >
              View storefront ↗
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-3 py-1.5 font-medium text-neutral-900 hover:bg-neutral-100"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
