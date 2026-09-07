/**
 * Local development helper: sets a known password on a store so the dashboard
 * can be opened while working on it. Never run against production.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const slug = process.argv[2];
const password = process.argv[3];

if (!slug || !password) {
  console.error("Usage: tsx scripts/dev-set-password.ts <slug> <password>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword(password);
  const store = await prisma.store.update({ where: { slug }, data: { passwordHash } });
  console.log(`Password set for ${store.slug} (${store.email})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
