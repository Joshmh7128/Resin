import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { syncStoreInventory } from "../src/lib/sync";

const prisma = new PrismaClient();

const DEMO_SLUG = "demo";
const DEMO_EMAIL = "demo@resin.local";
const DEMO_DISCOGS_USERNAME = "waxidermy";

async function main() {
  const existing = await prisma.store.findUnique({ where: { slug: DEMO_SLUG } });

  const store =
    existing ??
    (await prisma.store.create({
      data: {
        slug: DEMO_SLUG,
        name: "Resin Demo Store",
        email: DEMO_EMAIL,
        // Random on every fresh seed. This account is a public storefront demo,
        // never meant to be logged into, so no one should know its password.
        passwordHash: await hashPassword(randomBytes(24).toString("hex")),
        discogsUsername: DEMO_DISCOGS_USERNAME,
        description:
          "A live demo pulling real inventory from an actual Discogs seller account. Search, browse, and click into an item to see what your customers would see.",
        accentColor: "#9333ea",
      },
    }));

  console.log(`Demo store ready: /store/${store.slug}`);

  if (store.lastSyncAt) {
    console.log(`Demo store already synced (last: ${store.lastSyncAt.toISOString()}). Skipping.`);
    return;
  }

  console.log("Syncing demo inventory from Discogs. This can take a minute or two...");
  const result = await syncStoreInventory(store);
  console.log(
    result.ok
      ? `Synced ${result.total} listings (${result.added} new, ${result.removed} removed).`
      : `Demo sync failed: ${result.error}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
