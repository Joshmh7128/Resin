import { prisma } from "@/lib/prisma";
import { fetchAllInventoryListings, mapListingToItem, DiscogsError } from "@/lib/discogs";
import { startWarmingStore } from "@/lib/item-image";
import type { Store } from "@prisma/client";

export interface SyncResult {
  ok: boolean;
  total?: number;
  added?: number;
  removed?: number;
  error?: string;
}

/**
 * A sync claimed longer ago than this is treated as abandoned. Without this, a
 * process that dies mid-sync (a deploy, or Render's free tier spinning the
 * service down) would leave the store stuck on "running" and unable to ever
 * sync again.
 */
const STALE_SYNC_MS = 15 * 60 * 1000;

export function isSyncRunning(
  store: Pick<Store, "lastSyncStatus" | "syncStartedAt">,
): boolean {
  if (store.lastSyncStatus !== "running" || !store.syncStartedAt) return false;
  return Date.now() - store.syncStartedAt.getTime() < STALE_SYNC_MS;
}

/**
 * Claims and starts a sync, returning immediately rather than awaiting it.
 *
 * A full sync takes 40-60s, which is well past Render's ~15s request timeout,
 * so it cannot run inside the request that triggers it. Instead the request
 * only claims the sync and the work continues detached; the dashboard polls
 * `lastSyncStatus` to follow along. This depends on running as a long-lived
 * Node process (`next start`), not a serverless function that would be frozen
 * once the response is sent.
 */
export async function startInventorySync(
  storeId: string,
): Promise<{ started: boolean; reason?: string }> {
  const staleBefore = new Date(Date.now() - STALE_SYNC_MS);

  // Claim atomically: only one caller can flip the row into "running", so a
  // double-click (or two tabs) can't launch two syncs over the same store.
  const claim = await prisma.store.updateMany({
    where: {
      id: storeId,
      OR: [
        { lastSyncStatus: { not: "running" } },
        { lastSyncStatus: null },
        { syncStartedAt: null },
        { syncStartedAt: { lt: staleBefore } },
      ],
    },
    data: {
      lastSyncStatus: "running",
      lastSyncError: null,
      syncStartedAt: new Date(),
    },
  });

  if (claim.count === 0) {
    return { started: false, reason: "A sync is already running for this store." };
  }

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return { started: false, reason: "Store not found." };

  void syncStoreInventory(store).catch(() => {
    // syncStoreInventory records its own failures on the store row; this catch
    // only stops an unhandled rejection from taking down the process.
  });

  return { started: true };
}

/*
 * Cover art is not fetched inline here. Discogs' inventory endpoint omits
 * artwork, so each image costs a separate release lookup against a throttle of
 * roughly one request every 2.8s — far too slow to do while a sync runs. Once
 * the listings are in, the store is handed to the image warmer, which fills in
 * artwork in the background and always yields to customers browsing the shop.
 * See `src/lib/item-image.ts`.
 */

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

    // Listings are in; now fill in artwork for anything still missing it.
    // Runs in the background at low priority behind customer requests.
    startWarmingStore(store.id);

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
