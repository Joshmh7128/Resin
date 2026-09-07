import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { itemMetadata } from "@/lib/metadata";
import { prisma } from "@/lib/prisma";
import { formatPrice, decodeHtmlEntities } from "@/lib/format";
import { enrichItemFromRelease } from "@/lib/item-image";
import { resolvePresentation } from "@/lib/theme";
import { StorefrontFrame } from "@/components/StorefrontFrame";
import { PARAM } from "@/lib/storefront-query";

interface EnrichedDetails {
  genres: string[];
  styles: string[];
  images: string[];
  notes: string | null;
  tracklist: { position: string; title: string; duration: string }[];
  labels: string[];
}

function safeParseArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  return itemMetadata(slug, id);
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const store = await prisma.store.findUnique({ where: { slug } });
  if (!store) notFound();

  const item = await prisma.inventoryItem.findFirst({
    where: { id, storeId: store.id, isVisible: true },
  });
  if (!item) notFound();

  const presentation = resolvePresentation(store);

  let details: EnrichedDetails;

  if (item.genres === null) {
    try {
      details = await enrichItemFromRelease(item, store.discogsToken);
    } catch {
      details = {
        genres: [],
        styles: [],
        images: item.imageUrl ? [item.imageUrl] : [],
        notes: null,
        tracklist: [],
        labels: [],
      };
    }
  } else {
    const raw = item.rawData
      ? (JSON.parse(item.rawData) as {
          notes?: string | null;
          tracklist?: { position: string; title: string; duration: string }[];
          labels?: string[];
          images?: string[];
        })
      : {};
    details = {
      genres: safeParseArray(item.genres),
      styles: safeParseArray(item.styles),
      images: raw.images?.length ? raw.images : item.imageUrl ? [item.imageUrl] : [],
      notes: raw.notes ?? null,
      tracklist: raw.tracklist ?? [],
      labels: raw.labels ?? [],
    };
  }

  return (
    <StorefrontFrame presentation={presentation}>
      <header className="border-b border-st-border bg-st-surface">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 sm:py-4">
          <Link
            href={`/store/${slug}`}
            className="text-sm text-st-muted transition hover:text-st-fg"
          >
            ← Back to {store.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid gap-8 md:grid-cols-2 md:gap-10">
          <div>
            {details.images.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-st-border bg-st-surface">
                <Image
                  src={details.images[0]}
                  alt={`${item.artist} - ${item.title}`}
                  width={600}
                  height={600}
                  unoptimized
                  className="w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-st-border bg-st-surface-2 text-st-faint">
                No image available
              </div>
            )}
            {details.images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {details.images.slice(1, 5).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="aspect-square w-full rounded object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-st-fg">{item.title}</h1>
            <p className="mt-1 text-lg text-st-muted">{item.artist}</p>

            <p className="mt-4 text-3xl font-bold text-st-fg">
              {formatPrice(item.price, item.priceCurrency)}
            </p>

            <a
              href={item.discogsUri ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-md bg-st-accent px-6 py-3 text-sm font-semibold text-st-accent-fg"
            >
              Buy on Discogs ↗
            </a>

            <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label="Media condition" value={item.condition} />
              <Detail label="Sleeve condition" value={item.sleeveCondition} />
              <Detail label="Format" value={item.format} />
              <Detail label="Year" value={item.year?.toString()} />
              <Detail label="Pressed in" value={item.country} />
              <Detail label="Catalog #" value={item.catalogNumber} />
              <Detail label="Label" value={details.labels.join(", ") || null} />
            </dl>

            {/* Genres and styles link back into the shop, filtered. A customer
                who likes this record can find the rest of the shelf it came
                from without composing a search. */}
            <TagLinks slug={slug} param={PARAM.genre} label="Genre" values={details.genres} />
            <TagLinks slug={slug} param={PARAM.style} label="Style" values={details.styles} />

            {item.comments && (
              <Section title="Seller notes">{decodeHtmlEntities(item.comments)}</Section>
            )}

            {details.notes && (
              <Section title="Release notes">{decodeHtmlEntities(details.notes)}</Section>
            )}

            {details.tracklist.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-st-fg">Tracklist</h2>
                <ol className="mt-2 space-y-1 text-sm text-st-muted">
                  {details.tracklist.map((track, i) => (
                    <li key={`${track.position}-${i}`} className="flex justify-between gap-4">
                      <span>
                        {track.position ? `${track.position}. ` : ""}
                        {decodeHtmlEntities(track.title)}
                      </span>
                      {track.duration && <span className="text-st-faint">{track.duration}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <a
              href={item.releaseUri ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-block text-sm text-st-faint underline"
            >
              View full release on Discogs
            </a>
          </div>
        </div>
      </main>
    </StorefrontFrame>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-st-faint">{label}</dt>
      <dd className="font-medium text-st-fg">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-st-fg">{title}</h2>
      <p className="mt-1 whitespace-pre-wrap text-sm text-st-muted">{children}</p>
    </div>
  );
}

function TagLinks({
  slug,
  param,
  label,
  values,
}: {
  slug: string;
  param: string;
  label: string;
  values: string[];
}) {
  if (values.length === 0) return null;
  return (
    <div className="mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-st-faint">{label}</h2>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <Link
            key={value}
            href={`/store/${slug}?${param}=${encodeURIComponent(value)}`}
            className="rounded-full border border-st-border bg-st-surface-2 px-2.5 py-1 text-xs font-medium text-st-fg transition hover:bg-st-surface"
          >
            {value}
          </Link>
        ))}
      </div>
    </div>
  );
}
