import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mail is the only side effect worth faking here: everything else (Prisma, the
// audit log, the plan columns) is real, so these run against the database the
// job actually touches.
vi.mock("@/lib/mailer", () => ({
  sendMail: vi.fn(async () => ({ delivered: true, transport: "log" as const })),
  isMailConfigured: () => true,
}));

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { runPremiumMaintenance } from "@/lib/premium-expiry";
import { PLAN_FREE, PLAN_PREMIUM } from "@/lib/plan";

const SLUG_PREFIX = "expiry-test-";
const DAY = 24 * 60 * 60 * 1000;
const mockSendMail = vi.mocked(sendMail);

async function makeStore(
  name: string,
  data: {
    plan?: string;
    premiumUntil?: Date | null;
    expiryNoticeSentAt?: Date | null;
    isSuspended?: boolean;
  },
) {
  return prisma.store.create({
    data: {
      slug: `${SLUG_PREFIX}${name}`,
      name: `Expiry ${name}`,
      email: `${SLUG_PREFIX}${name}@example.com`,
      passwordHash: "not-a-real-hash",
      discogsUsername: "example",
      plan: data.plan ?? PLAN_PREMIUM,
      premiumUntil: data.premiumUntil ?? null,
      expiryNoticeSentAt: data.expiryNoticeSentAt ?? null,
      isSuspended: data.isSuspended ?? false,
    },
  });
}

async function cleanUp() {
  const stores = await prisma.store.findMany({
    where: { slug: { startsWith: SLUG_PREFIX } },
    select: { id: true },
  });
  await prisma.adminAuditLog.deleteMany({
    where: { targetStoreId: { in: stores.map((store) => store.id) } },
  });
  await prisma.store.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
}

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanUp();
  mockSendMail.mockClear();
});

describe("runPremiumMaintenance", () => {
  it("moves a lapsed store to free but keeps its end date", async () => {
    const lapsedAt = new Date(Date.now() - 2 * DAY);
    const store = await makeStore("lapsed", { premiumUntil: lapsedAt });

    const result = await runPremiumMaintenance();
    expect(result.expiredStores).toContain(store.slug);

    const after = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(after.plan).toBe(PLAN_FREE);
    // Kept, so the admin can tell a lapsed customer from someone who never paid.
    expect(after.premiumUntil?.toISOString()).toBe(lapsedAt.toISOString());
  });

  it("writes an audit entry for each expiry, attributed to the system", async () => {
    const store = await makeStore("audited", { premiumUntil: new Date(Date.now() - DAY) });
    await runPremiumMaintenance();

    const entry = await prisma.adminAuditLog.findFirst({
      where: { targetStoreId: store.id, action: "store.premium.expired" },
    });
    expect(entry?.adminEmail).toBe("system");
    expect(entry?.adminUserId).toBeNull();
  });

  it("leaves a store with plenty of time alone", async () => {
    const store = await makeStore("healthy", { premiumUntil: new Date(Date.now() + 60 * DAY) });

    const result = await runPremiumMaintenance();

    expect(result.expiredStores).not.toContain(store.slug);
    expect(result.warnedStores).not.toContain(store.slug);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("never touches a comped account with no end date", async () => {
    const store = await makeStore("comped", { premiumUntil: null });

    await runPremiumMaintenance();

    const after = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });
    expect(after.plan).toBe(PLAN_PREMIUM);
    expect(after.premiumUntil).toBeNull();
  });

  it("warns once per period, not once per run", async () => {
    const store = await makeStore("warned", { premiumUntil: new Date(Date.now() + 3 * DAY) });

    const first = await runPremiumMaintenance();
    expect(first.warnedStores).toContain(store.slug);
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const second = await runPremiumMaintenance();
    expect(second.warnedStores).not.toContain(store.slug);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it("does not email a suspended store", async () => {
    await makeStore("suspended", {
      premiumUntil: new Date(Date.now() + 2 * DAY),
      isSuspended: true,
    });

    const result = await runPremiumMaintenance();

    expect(result.warned).toBe(0);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("is safe to run twice over the same lapse", async () => {
    const store = await makeStore("repeat", { premiumUntil: new Date(Date.now() - DAY) });

    await runPremiumMaintenance();
    const second = await runPremiumMaintenance();

    expect(second.expiredStores).not.toContain(store.slug);
    const entries = await prisma.adminAuditLog.count({
      where: { targetStoreId: store.id, action: "store.premium.expired" },
    });
    expect(entries).toBe(1);
  });
});
