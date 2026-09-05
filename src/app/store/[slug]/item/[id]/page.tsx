import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice, decodeHtmlEntities } from "@/lib/format";
import { enrichItemFromRelease } from "@/lib/item-image";

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
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <Link href={`/store/${slug}`} className="text-sm text-neutral-600 hover:text-neutral-900">
            ← Back to {store.name}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            {details.images.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
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
              <div className="flex aspect-square items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-400">
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
            <h1 className="text-2xl font-bold text-neutral-900">{item.title}</h1>
            <p className="mt-1 text-lg text-neutral-600">{item.artist}</p>

            <p className="mt-4 text-3xl font-bold text-neutral-900">
              {formatPrice(item.price, item.priceCurrency)}
            </p>

            <a
              href={item.discogsUri ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-700"
            >
              Buy on Discogs ↗
            </a>

            <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label="Media condition" value={item.condition} />
              <Detail label="Sleeve condition" value={item.sleeveCondition} />
              <Detail label="Format" value={item.format} />
              <Detail label="Year" value={item.year?.toString()} />
              <Detail label="Catalog #" value={item.catalogNumber} />
              <Detail label="Label" value={details.labels.join(", ") || null} />
              <Detail label="Genre" value={details.genres.join(", ") || null} />
              <Detail label="Style" value={details.styles.join(", ") || null} />
            </dl>

            {item.comments && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-neutral-900">Seller notes</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">
                  {decodeHtmlEntities(item.comments)}
                </p>
              </div>
            )}

            {details.notes && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-neutral-900">Release notes</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">
                  {decodeHtmlEntities(details.notes)}
                </p>
              </div>
            )}

            {details.tracklist.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-neutral-900">Tracklist</h2>
                <ol className="mt-2 space-y-1 text-sm text-neutral-600">
                  {details.tracklist.map((track, i) => (
                    <li key={`${track.position}-${i}`} className="flex justify-between gap-4">
                      <span>
                        {track.position ? `${track.position}. ` : ""}
                        {decodeHtmlEntities(track.title)}
                      </span>
                      {track.duration && <span className="text-neutral-400">{track.duration}</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <a
              href={item.releaseUri ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-block text-sm text-neutral-500 underline"
            >
              View full release on Discogs
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-neutral-400">{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}
