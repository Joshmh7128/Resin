import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getBaseUrl } from "@/lib/url";

/**
 * Page metadata and social previews for storefronts and item pages.
 *
 * These links get pasted into messages, socials and QR-code landing scans, so a
 * bare URL with no title or picture is a wasted impression. Both builders fall
 * back to something sensible when a store hasn't set a logo or an item has no
 * artwork cached yet.
 */

function absolute(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

export async function storeMetadata(slug: string): Promise<Metadata> {
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      city: true,
      country: true,
      logoUrl: true,
      accentColor: true,
    },
  });

  if (!store) return { title: "Store not found" };

  const [baseUrl, itemCount, firstArt] = await Promise.all([
    getBaseUrl(),
    prisma.inventoryItem.count({ where: { store: { slug }, isVisible: true } }),
    prisma.inventoryItem.findFirst({
      where: { store: { slug }, isVisible: true, imageUrl: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { imageUrl: true },
    }),
  ]);

  const place = [store.city, store.country].filter(Boolean).join(", ");
  const description =
    store.description ??
    `Browse ${itemCount.toLocaleString()} record${itemCount === 1 ? "" : "s"} for sale${
      place ? ` from ${store.name} in ${place}` : ` from ${store.name}`
    }.`;

  // Prefer the shop's own logo; otherwise the newest cover art stands in, which
  // is far more recognisable than nothing.
  const image = store.logoUrl ?? firstArt?.imageUrl ?? undefined;
  const url = absolute(baseUrl, `/store/${slug}`);

  return {
    title: place ? `${store.name} (${place})` : store.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: store.name,
      title: store.name,
      description,
      url,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: store.name,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export async function itemMetadata(slug: string, itemId: string): Promise<Metadata> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, isVisible: true, store: { slug } },
    select: {
      title: true,
      artist: true,
      price: true,
      priceCurrency: true,
      condition: true,
      format: true,
      year: true,
      imageUrl: true,
      thumbUrl: true,
      store: { select: { name: true } },
    },
  });

  if (!item) return { title: "Record not found" };

  const baseUrl = await getBaseUrl();
  const heading = `${item.artist} - ${item.title}`;
  const details = [
    item.format,
    item.year ? String(item.year) : null,
    item.condition,
    formatPrice(item.price, item.priceCurrency),
  ]
    .filter(Boolean)
    .join(" · ");

  const image = item.imageUrl ?? item.thumbUrl ?? undefined;
  const url = absolute(baseUrl, `/store/${slug}/item/${itemId}`);

  return {
    title: `${heading} | ${item.store.name}`,
    description: `${details}. For sale at ${item.store.name}.`,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: item.store.name,
      title: heading,
      description: details,
      url,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: heading,
      description: details,
      images: image ? [image] : undefined,
    },
  };
}
