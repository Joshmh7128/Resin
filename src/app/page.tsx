import Link from "next/link";
import { getCurrentStore } from "@/lib/auth";

export default async function HomePage() {
  const store = await getCurrentStore();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Resin</span>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/store/demo" className="text-neutral-600 hover:text-neutral-900">
              View demo
            </Link>
            {store ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700"
                >
                  List your store
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
            Turn your Discogs inventory into a store your customers can browse
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            Resin connects to your Discogs seller inventory and gives you a searchable,
            paginated storefront page — perfect for a QR code on the counter so
            customers can browse your crates from their phone.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-700"
            >
              Set up your store
            </Link>
            <Link
              href="/store/demo"
              className="rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
            >
              View live demo
            </Link>
          </div>
          <p className="mt-4 text-sm text-neutral-500">
            Already have a store?{" "}
            <Link href="/login" className="underline">
              Log in
            </Link>
          </p>
        </section>

        <section className="border-t border-neutral-200 bg-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
            <Feature
              title="Live from Discogs"
              body="Sync your public Discogs marketplace listings into a fast, searchable catalog with one click."
            />
            <Feature
              title="Scan to browse"
              body="Every store gets a QR code linking straight to its storefront — print it for the shop counter or crates."
            />
            <Feature
              title="You stay in control"
              body="Feature your best finds, hide items you're not ready to show, and manage your storefront from a simple dashboard."
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-sm text-neutral-500">
        Built on the Discogs API. Not affiliated with Discogs.
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600">{body}</p>
    </div>
  );
}
