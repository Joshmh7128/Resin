import Link from "next/link";
import { storeMeta } from "@/lib/format";
import { storeLinks, type StoreLink } from "@/lib/store-links";
import { StoreLinkIcon } from "@/components/StoreLinkIcon";
import type { StorePresentation } from "@/lib/theme";
import type { Store, StoreLocation } from "@prisma/client";

export type StoreWithLocations = Store & { locations: StoreLocation[] };

/**
 * Storefront masthead, deliberately short.
 *
 * The records are what customers came for, so the shop's own details stay
 * behind a disclosure and the header itself is one row (compact) or a shallow
 * banner. That matters most on a phone, where a tall header pushes the whole
 * catalogue below the fold. Uses native details/summary, so it costs no client
 * JavaScript and works before hydration.
 */
export function StoreHeader({
  store,
  itemCount,
  presentation,
}: {
  store: StoreWithLocations;
  itemCount: number;
  presentation: StorePresentation;
}) {
  const banner = presentation.headerStyle === "banner" && store.bannerUrl;
  const about = collectAbout(store);

  const meta = (
    <p className="truncate text-xs text-st-faint">{storeMeta(itemCount, store.lastSyncAt)}</p>
  );

  // The profile picture sits beside the name in its own row, never over the
  // banner. Overlapping the two looked like a rendering fault, and on a phone
  // it left the picture half-buried in whatever the banner happened to show.
  const avatar = store.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={store.logoUrl}
      alt=""
      className={
        banner
          ? "h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-st-border sm:h-14 sm:w-14"
          : "h-9 w-9 shrink-0 rounded object-cover ring-1 ring-st-border sm:h-11 sm:w-11"
      }
    />
  ) : null;

  const identity = (
    <>
      {avatar}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-st-fg sm:text-xl">
          {store.name}
        </h1>
        {meta}
      </div>
    </>
  );

  return (
    <header className="border-b border-st-border bg-st-surface">
      {banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={store.bannerUrl!} alt="" className="h-20 w-full object-cover sm:h-36" />
      )}
      <div className="h-1 w-full bg-st-accent" aria-hidden />

      <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6 sm:py-3">
        {about.hasAny ? (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              {identity}
              <InfoPill />
            </summary>

            <StoreAbout store={store} about={about} />
          </details>
        ) : (
          <div className="flex items-center gap-3">{identity}</div>
        )}
      </div>
    </header>
  );
}

function InfoPill() {
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full border border-st-border bg-st-surface px-2.5 py-1 text-xs font-medium text-st-muted transition group-hover:bg-st-surface-2"
    >
      <span className="hidden sm:inline">Shop info</span>
      <span className="sm:hidden">Info</span>
      <svg
        viewBox="0 0 12 12"
        aria-hidden
        className="h-3 w-3 transition-transform group-open:rotate-180"
      >
        <path
          d="M2.5 4.5 6 8l3.5-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

interface AboutContent {
  text: string | null;
  links: StoreLink[];
  locations: StoreLocation[];
  hasAny: boolean;
}

function collectAbout(store: StoreWithLocations): AboutContent {
  const links = storeLinks(store);

  // The longer "about" copy wins when a shop has written one; `description` is
  // the short line used for search results and link previews.
  const text = store.aboutText ?? store.description;
  const locations = store.locations.filter(hasAnything);

  return {
    text,
    links,
    locations,
    hasAny: Boolean(text) || links.length > 0 || locations.length > 0,
  };
}

function hasAnything(location: StoreLocation): boolean {
  return Boolean(
    location.addressLine ||
      location.city ||
      location.postcode ||
      location.country ||
      location.phone ||
      location.openingHours,
  );
}

function StoreAbout({ store, about }: { store: StoreWithLocations; about: AboutContent }) {
  return (
    <div className="mt-4 border-t border-st-border pt-4">
      {about.text && (
        <p className="max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-st-muted">
          {about.text}
        </p>
      )}

      {about.locations.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {about.locations.map((location) => (
            <LocationCard key={location.id} storeName={store.name} location={location} />
          ))}
        </div>
      )}

      {about.links.length > 0 && (
        <nav className="mt-4 flex flex-wrap gap-2">
          {about.links.map((link) => (
            <a
              key={link.kind}
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-st-border px-3 py-1 text-xs font-medium text-st-muted transition hover:bg-st-surface-2"
            >
              <StoreLinkIcon kind={link.kind} />
              {link.label}
            </a>
          ))}
        </nav>
      )}

      <p className="mt-4 text-xs text-st-faint">
        Inventory synced from{" "}
        <Link
          href={`https://www.discogs.com/user/${store.discogsUsername}`}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Discogs
        </Link>
        . Don&apos;t see what you&apos;re looking for? Ask a staff member to sync our inventory.
      </p>
    </div>
  );
}

function LocationCard({
  storeName,
  location,
}: {
  storeName: string;
  location: StoreLocation;
}) {
  const address = [location.addressLine, location.city, location.postcode, location.country]
    .filter(Boolean)
    .join(", ");

  const hours = (location.openingHours ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="rounded-lg border border-st-border bg-st-surface-2 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-st-faint">
        {location.label ?? "Visit"}
      </h2>

      {address && (
        <>
          <p className="mt-1 text-sm text-st-fg">{address}</p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${storeName} ${address}`,
            )}`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-st-muted underline"
          >
            Open in maps
          </a>
        </>
      )}

      {location.phone && (
        <p className="mt-2">
          <a
            href={`tel:${location.phone.replace(/\s+/g, "")}`}
            className="text-sm text-st-fg hover:underline"
          >
            {location.phone}
          </a>
        </p>
      )}

      {hours.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm text-st-muted">
          {hours.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
