import Link from "next/link";
import { formatRelativeTime } from "@/lib/format";
import type { Store } from "@prisma/client";

/**
 * Storefront masthead. A record shop is a physical place, so this carries the
 * things a customer actually wants: who you are, where you are, when you're
 * open, and how fresh the listings are. Every detail is optional and simply
 * isn't rendered when a store hasn't filled it in.
 */
export function StoreHeader({ store, itemCount }: { store: Store; itemCount: number }) {
  const links = [
    { label: "Website", href: store.websiteUrl },
    { label: "Instagram", href: store.instagramUrl },
    { label: "Facebook", href: store.facebookUrl },
    { label: "Bandcamp", href: store.bandcampUrl },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href));

  const address = [store.addressLine, store.city, store.postcode, store.country]
    .filter(Boolean)
    .join(", ");

  const hours = (store.openingHours ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const hasShopDetails = Boolean(address || store.phone || hours.length > 0 || links.length > 0);

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="h-1.5 w-full" style={{ backgroundColor: store.accentColor }} aria-hidden />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {store.logoUrl && (
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={store.logoUrl}
                alt=""
                className="h-20 w-20 rounded-lg object-cover ring-1 ring-neutral-200"
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
              {store.name}
            </h1>

            {store.description && (
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-600">
                {store.description}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-500">
              <span className="font-medium text-neutral-900">
                {itemCount.toLocaleString()} record{itemCount === 1 ? "" : "s"} in stock
              </span>
              {store.lastSyncAt && (
                <>
                  <span aria-hidden className="text-neutral-300">
                    &bull;
                  </span>
                  <span>updated {formatRelativeTime(store.lastSyncAt)}</span>
                </>
              )}
            </div>

            {links.length > 0 && (
              <nav className="mt-4 flex flex-wrap gap-2">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            )}
          </div>
        </div>

        {hasShopDetails && (address || store.phone || hours.length > 0) && (
          <div className="mt-8 grid gap-6 border-t border-neutral-100 pt-6 sm:grid-cols-2 lg:grid-cols-3">
            {address && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Visit
                </h2>
                <p className="mt-1 text-sm text-neutral-700">{address}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${store.name} ${address}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-1 inline-block text-sm text-neutral-500 underline"
                >
                  Open in maps
                </a>
              </div>
            )}

            {store.phone && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Call
                </h2>
                <a
                  href={`tel:${store.phone.replace(/\s+/g, "")}`}
                  className="mt-1 inline-block text-sm text-neutral-700 hover:underline"
                >
                  {store.phone}
                </a>
              </div>
            )}

            {hours.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Opening hours
                </h2>
                <ul className="mt-1 space-y-0.5 text-sm text-neutral-700">
                  {hours.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="mt-6 text-xs text-neutral-400">
          Inventory synced from{" "}
          <Link
            href={`https://www.discogs.com/user/${store.discogsUsername}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Discogs
          </Link>
          . Don&apos;t see what you&apos;re looking for? Ask a staff member to sync our
          inventory.
        </p>
      </div>
    </header>
  );
}
