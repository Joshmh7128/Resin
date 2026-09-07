import { prisma } from "@/lib/prisma";
import { recordAdminAction, SYSTEM_ACTOR } from "@/lib/admin/audit";
import { sendMail } from "@/lib/mailer";
import { PLAN_FREE, PLAN_PREMIUM, EXPIRING_SOON_DAYS } from "@/lib/plan";

/**
 * The scheduled half of plan management: warn stores whose premium is about to
 * run out, and move the ones that already have back to free.
 *
 * Entitlement itself does not depend on this running. `isPremiumActive` reads
 * the end date directly, so a store that lapses is out of premium immediately
 * whether or not the job has fired. What the job adds is the paperwork: the
 * plan column matching reality, an audit entry for the lapse, and the emails.
 * That means it is safe to run late, twice, or not at all for a day.
 */

export interface PremiumMaintenanceResult {
  warned: number;
  expired: number;
  /** Slugs touched, so a manual run says what it did. */
  warnedStores: string[];
  expiredStores: string[];
}

function warningEmail(storeName: string, until: Date, days: number) {
  return {
    subject: `Your Resin premium ends in ${days} day${days === 1 ? "" : "s"}`,
    text: [
      `Hi ${storeName},`,
      "",
      `Your Resin premium runs out on ${until.toISOString().slice(0, 10)}.`,
      "Your storefront and inventory stay exactly as they are; you'll just be",
      "back on the free plan.",
      "",
      "Reply to this email if you'd like to keep premium going.",
    ].join("\n"),
  };
}

function expiredEmail(storeName: string) {
  return {
    subject: "Your Resin premium has ended",
    text: [
      `Hi ${storeName},`,
      "",
      "Your Resin premium has ended and your account is back on the free plan.",
      "Nothing has been deleted: your storefront, inventory, and settings are",
      "all still there.",
      "",
      "Reply to this email if you'd like it turned back on.",
    ].join("\n"),
  };
}

export async function runPremiumMaintenance(
  now: Date = new Date(),
): Promise<PremiumMaintenanceResult> {
  const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);

  // Warn first. A store whose last day is today gets its warning and its
  // expiry in the same run rather than only the expiry.
  const expiringSoon = await prisma.store.findMany({
    where: {
      plan: PLAN_PREMIUM,
      premiumUntil: { gt: now, lte: soon },
      // Cleared whenever premium is granted or extended, so each paid period
      // warns once and a renewal starts the count again.
      expiryNoticeSentAt: null,
      isSuspended: false,
    },
  });

  const warnedStores: string[] = [];
  for (const store of expiringSoon) {
    const until = store.premiumUntil;
    if (!until) continue;
    const days = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 86_400_000));
    await sendMail({ to: store.email, ...warningEmail(store.name, until, days) });
    await prisma.store.update({
      where: { id: store.id },
      data: { expiryNoticeSentAt: now },
    });
    warnedStores.push(store.slug);
  }

  const lapsed = await prisma.store.findMany({
    where: { plan: PLAN_PREMIUM, premiumUntil: { not: null, lte: now } },
  });

  const expiredStores: string[] = [];
  for (const store of lapsed) {
    // The end date is kept rather than cleared: it is what tells the admin
    // backend this is a lapsed customer and not someone who never paid.
    await prisma.store.update({
      where: { id: store.id },
      data: { plan: PLAN_FREE },
    });
    await sendMail({ to: store.email, ...expiredEmail(store.name) });
    await recordAdminAction({
      actor: SYSTEM_ACTOR,
      action: "store.premium.expired",
      store: { id: store.id, slug: store.slug },
      summary: `Premium ended for ${store.slug}`,
      metadata: { premiumUntil: store.premiumUntil?.toISOString() ?? null },
    });
    expiredStores.push(store.slug);
  }

  return {
    warned: warnedStores.length,
    expired: expiredStores.length,
    warnedStores,
    expiredStores,
  };
}
