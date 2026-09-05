/**
 * Ad-hoc verification for the two concurrency guards in startInventorySync:
 *   1. Two simultaneous starts must not both claim the sync.
 *   2. A "running" status older than the stale window must not block a new sync.
 *
 * Run with: npx tsx scripts/verify-sync-guards.ts
 */
import { PrismaClient } from "@prisma/client";
import { isSyncRunning } from "../src/lib/sync";

const prisma = new PrismaClient();
const SLUG = "bgsync-test";

async function main() {
  const store = await prisma.store.findUniqueOrThrow({ where: { slug: SLUG } });

  // --- Guard 1: concurrent claims -----------------------------------------
  await prisma.store.update({
    where: { id: store.id },
    data: { lastSyncStatus: "success", syncStartedAt: null },
  });

  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  const claimWhere = {
    id: store.id,
    OR: [
      { lastSyncStatus: { not: "running" } },
      { lastSyncStatus: null },
      { syncStartedAt: null },
      { syncStartedAt: { lt: staleBefore } },
    ],
  };

  const [a, b] = await Promise.all([
    prisma.store.updateMany({
      where: claimWhere,
      data: { lastSyncStatus: "running", syncStartedAt: new Date() },
    }),
    prisma.store.updateMany({
      where: claimWhere,
      data: { lastSyncStatus: "running", syncStartedAt: new Date() },
    }),
  ]);
  const winners = a.count + b.count;
  console.log(
    `Guard 1 (concurrent claim): ${winners} of 2 claims succeeded: ${winners === 1 ? "PASS" : "FAIL"}`,
  );

  // --- Guard 2: stale running status --------------------------------------
  const fresh = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
  console.log(
    `Guard 2a (fresh running blocks): isSyncRunning=${isSyncRunning(fresh)}: ${isSyncRunning(fresh) ? "PASS" : "FAIL"}`,
  );

  await prisma.store.update({
    where: { id: store.id },
    data: { syncStartedAt: new Date(Date.now() - 20 * 60 * 1000) },
  });
  const stale = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
  console.log(
    `Guard 2b (stale running expires): isSyncRunning=${isSyncRunning(stale)}: ${!isSyncRunning(stale) ? "PASS" : "FAIL"}`,
  );

  const staleClaim = await prisma.store.updateMany({
    where: claimWhere,
    data: { lastSyncStatus: "running", syncStartedAt: new Date() },
  });
  console.log(
    `Guard 2c (stale is reclaimable): claimed=${staleClaim.count}: ${staleClaim.count === 1 ? "PASS" : "FAIL"}`,
  );

  // Leave the store idle again.
  await prisma.store.update({
    where: { id: store.id },
    data: { lastSyncStatus: "success", syncStartedAt: null },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
