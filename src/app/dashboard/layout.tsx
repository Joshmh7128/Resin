import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const store = await requireStore();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Resin
            </Link>
            <nav className="flex gap-6 text-sm font-medium text-neutral-600">
              <Link href="/dashboard" className="hover:text-neutral-900">
                Overview
              </Link>
              <Link href="/dashboard/inventory" className="hover:text-neutral-900">
                Inventory
              </Link>
              <Link href="/dashboard/settings" className="hover:text-neutral-900">
                Settings
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
