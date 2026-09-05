import { prisma } from "@/lib/prisma";
import {
  fetchAllInventoryListings,
  fetchReleaseDetails,
  mapListingToItem,
  DiscogsError,
} from "@/lib/discogs";
import type { InventoryItem, Store } from "@prisma/client";

export interface SyncResult {
  ok: boolean;
  total?: number;
  added?: number;
  removed?: number;
  error?: string;
}

/**
 * Fetches the full release (genres, styles, full-size images, notes, tracklist)
 * and caches it on the item. Used both for on-demand detail-page enrichment and
 * for the background thumbnail backfill below.
 */
export async function enrichItemFromRelease(
  item: Pick<InventoryItem, "id" | "releaseId" | "thumbUrl">,
  token: string | null | undefined,
) {
  const details = await fetchReleaseDetails(item.releaseId, token);
  await prisma.inventoryItem.update({
    where: { id: item.id },
    data: {
      genres: JSON.stringify(details.genres),
      styles: JSON.stringify(details.styles),
      imageUrl: details.images[0] ?? item.thumbUrl,
      rawData: JSON.stringify({
        notes: details.notes,
        tracklist: details.tracklist,
        labels: details.labels,
        images: details.images,
      }),
    },
  });
  return details;
}

const BACKFILL_LIMIT = 60;

/**
 * Discogs' inventory listing endpoint frequently omits cover art. Full images only
 * come from the release resource, which is too expensive to fetch for every item
 * during sync. Instead, backfill a bounded batch of the newest missing-image items
 * after sync completes, without blocking the sync response. This relies on running
 * on a long-lived Node process (not a serverless function) so the detached work
 * keeps running after the request completes — true for `next dev`/`next start`.
 */
async function backfillThumbnails(store: Store): Promise<void> {
  const items = await prisma.inventoryItem.findMany({
    where: { storeId: store.id, imageUrl: null },
    orderBy: { updatedAt: "desc" },
    take: BACKFILL_LIMIT,
    select: { id: true, releaseId: true, thumbUrl: true },
  });

  for (const item of items) {
    try {
      await enrichItemFromRelease(item, store.discogsToken);
    } catch {
      // Skip items whose release lookup fails (e.g. removed release) and move on.
    }
  }
}

export async function syncStoreInventory(store: Store): Promise<SyncResult> {
  try {
    const listings = await fetchAllInventoryListings(store.discogsUsername, store.discogsToken);
    const forSale = listings.filter((l) => l.status === "For Sale");

    const existing = await prisma.inventoryItem.findMany({
      where: { storeId: store.id },
      select: { id: true, listingId: true },
    });
    const existingIds = new Set(existing.map((e) => e.listingId.toString()));
    const currentIds = new Set(forSale.map((l) => String(l.id)));

    let added = 0;
    for (const listing of forSale) {
      const mapped = mapListingToItem(listing);
      if (!existingIds.has(String(listing.id))) added += 1;
      await prisma.inventoryItem.upsert({
        where: {
          storeId_listingId: { storeId: store.id, listingId: BigInt(mapped.listingId) },
        },
        update: {
          releaseId: mapped.releaseId,
          title: mapped.title,
          artist: mapped.artist,
          catalogNumber: mapped.catalogNumber,
          format: mapped.format,
          year: mapped.year,
          condition: mapped.condition,
          sleeveCondition: mapped.sleeveCondition,
          price: mapped.price,
          priceCurrency: mapped.priceCurrency,
          comments: mapped.comments,
          thumbUrl: mapped.thumbUrl,
          discogsUri: mapped.discogsUri,
          releaseUri: mapped.releaseUri,
          status: mapped.status,
          searchText: mapped.searchText,
        },
        create: {
          storeId: store.id,
          listingId: BigInt(mapped.listingId),
          releaseId: mapped.releaseId,
          title: mapped.title,
          artist: mapped.artist,
          catalogNumber: mapped.catalogNumber,
          format: mapped.format,
          year: mapped.year,
          condition: mapped.condition,
          sleeveCondition: mapped.sleeveCondition,
          price: mapped.price,
          priceCurrency: mapped.priceCurrency,
          comments: mapped.comments,
          thumbUrl: mapped.thumbUrl,
          imageUrl: mapped.imageUrl,
          discogsUri: mapped.discogsUri,
          releaseUri: mapped.releaseUri,
          status: mapped.status,
          searchText: mapped.searchText,
        },
      });
    }

    const idsToRemove = existing
      .filter((e) => !currentIds.has(e.listingId.toString()))
      .map((e) => e.id);
    if (idsToRemove.length > 0) {
      await prisma.inventoryItem.deleteMany({
        where: { id: { in: idsToRemove } },
      });
    }

    await prisma.store.update({
      where: { id: store.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        lastSyncError: null,
      },
    });

    void backfillThumbnails(store).catch(() => {});

    return { ok: true, total: forSale.length, added, removed: idsToRemove.length };
  } catch (error) {
    const message =
      error instanceof DiscogsError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Unknown error during sync";

    await prisma.store.update({
      where: { id: store.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "error",
        lastSyncError: message,
      },
    });

    return { ok: false, error: message };
  }
}
