// Diagnostic: how much of a given storefront page has its artwork resolved,
// compared with the store-wide backlog. Used to check that a page a customer is
// viewing gets served ahead of the background warm.
import { PrismaClient } from "@prisma/client";

const PAGE = Number(process.argv[2] ?? 55);
const PAGE_SIZE = 24;

const prisma = new PrismaClient();
const store = await prisma.store.findUniqueOrThrow({ where: { slug: "demo" } });

const [total, remaining, pageItems] = await Promise.all([
  prisma.inventoryItem.count({ where: { storeId: store.id, isVisible: true } }),
  prisma.inventoryItem.count({
    where: { storeId: store.id, isVisible: true, imageUrl: null, genres: null },
  }),
  prisma.inventoryItem.findMany({
    where: { storeId: store.id, isVisible: true },
    orderBy: { createdAt: "desc" },
    skip: (PAGE - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { imageUrl: true, genres: true },
  }),
]);

const pageResolved = pageItems.filter((i) => i.imageUrl || i.genres !== null).length;

console.log(`store backlog remaining: ${remaining} of ${total}`);
console.log(`page ${PAGE} resolved:     ${pageResolved} of ${pageItems.length}`);

await prisma.$disconnect();
