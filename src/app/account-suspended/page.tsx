import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

/**
 * Where `requireStore` sends a suspended owner. It reads the session itself
 * rather than going through `requireStore`, which would bounce them back here.
 */
export default async function AccountSuspendedPage() {
  const store = await getCurrentStore();
  if (!store) redirect("/login");
  if (!store.isSuspended) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-neutral-900">This account is suspended</h1>
        <p className="mt-3 text-sm text-neutral-600">
          {store.suspendedReason
            ? store.suspendedReason
            : "Your dashboard and storefront are paused. Nothing has been deleted."}
        </p>
        <p className="mt-3 text-sm text-neutral-600">
          Get in touch if you think this is a mistake and we&apos;ll sort it out.
        </p>
        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
          >
            Log out
          </button>
        </form>
        <p className="mt-6 text-sm text-neutral-500">
          <Link href="/" className="underline">
            Back to Resin
          </Link>
        </p>
      </div>
    </div>
  );
}
