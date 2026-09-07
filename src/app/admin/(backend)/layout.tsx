import Link from "next/link";
import { requireAdmin, isOwner } from "@/lib/admin/auth";
import { adminLogoutAction } from "@/lib/admin/actions";

export const metadata = {
  title: "Resin admin",
  robots: { index: false, follow: false },
};

/**
 * Guards every page in the backend. The check lives here rather than in a proxy
 * so it runs in the same place the data is read, and so an unauthenticated
 * request can't reach a page by any route that skips a matcher.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="border-b border-neutral-800 bg-neutral-900 text-neutral-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="text-lg font-semibold tracking-tight">
              Resin admin
            </Link>
            <nav className="flex gap-6 text-sm font-medium text-neutral-400">
              <Link href="/admin" className="hover:text-white">
                Overview
              </Link>
              <Link href="/admin/stores" className="hover:text-white">
                Stores
              </Link>
              <Link href="/admin/audit" className="hover:text-white">
                Audit log
              </Link>
              {isOwner(admin) && (
                <Link href="/admin/admins" className="hover:text-white">
                  Admins
                </Link>
              )}
              <Link href="/admin/account" className="hover:text-white">
                My account
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-neutral-400 sm:inline">{admin.email}</span>
            <form action={adminLogoutAction}>
              <button
                type="submit"
                className="rounded-md border border-neutral-700 px-3 py-1.5 font-medium hover:bg-neutral-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
