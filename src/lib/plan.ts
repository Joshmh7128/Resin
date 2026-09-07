import type { Prisma } from "@prisma/client";

export const PLAN_FREE = "free";
export const PLAN_PREMIUM = "premium";

export type Plan = typeof PLAN_FREE | typeof PLAN_PREMIUM;

/** A premium period ending within this many days counts as "expiring soon". */
export const EXPIRING_SOON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The subset of a store row the plan helpers need. */
export interface PlanFields {
  plan: string;
  premiumUntil: Date | null;
}

export type PlanState =
  /** Never paid, or the lapse has already been acknowledged. */
  | { status: "free" }
  /** Premium with no end date: comped by an operator. */
  | { status: "lifetime" }
  /** Paid up with room to spare. */
  | { status: "active"; until: Date; daysRemaining: number }
  /** Paid up, but ending within `EXPIRING_SOON_DAYS`. */
  | { status: "expiring"; until: Date; daysRemaining: number }
  /**
   * The end date has passed. Still reported for stores the expiry job has
   * already moved back to free, so a lapse stays visible in the admin.
   */
  | { status: "expired"; until: Date; daysAgo: number };

export type PlanStatus = PlanState["status"];

/**
 * Days between two instants, rounded up, so an end date later today reads as
 * "1 day left" rather than "0".
 */
function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * The single source of truth for what a store's plan is right now.
 *
 * Expiry is derived from `premiumUntil` rather than waiting on the nightly
 * job, so a lapsed store loses premium the moment it lapses even if the job
 * hasn't run (or has failed) yet.
 */
export function planState(store: PlanFields, now: Date = new Date()): PlanState {
  if (store.premiumUntil === null) {
    return store.plan === PLAN_PREMIUM ? { status: "lifetime" } : { status: "free" };
  }

  const until = store.premiumUntil;
  if (until.getTime() <= now.getTime()) {
    return { status: "expired", until, daysAgo: daysBetween(until, now) };
  }

  // A store the expiry job has already downgraded keeps its end date for the
  // record, but it is no longer premium.
  if (store.plan !== PLAN_PREMIUM) return { status: "free" };

  const daysRemaining = daysBetween(now, until);
  return daysRemaining <= EXPIRING_SOON_DAYS
    ? { status: "expiring", until, daysRemaining }
    : { status: "active", until, daysRemaining };
}

/** Whether the store is entitled to premium features right now. */
export function isPremiumActive(store: PlanFields, now: Date = new Date()): boolean {
  const status = planState(store, now).status;
  return status === "active" || status === "expiring" || status === "lifetime";
}

/**
 * The new end date after granting `days` more of premium.
 *
 * Time is added on top of an unexpired period rather than replacing it, so
 * renewing early never costs a store the days it already has. A lapsed period
 * starts over from now, so nobody is credited for time they didn't have.
 */
export function extendPremium(
  currentUntil: Date | null,
  days: number,
  now: Date = new Date(),
): Date {
  const base =
    currentUntil !== null && currentUntil.getTime() > now.getTime() ? currentUntil : now;
  return new Date(base.getTime() + days * DAY_MS);
}

export function planLabel(state: PlanState): string {
  switch (state.status) {
    case "free":
      return "Free";
    case "lifetime":
      return "Premium, no expiry";
    case "active":
      return `Premium, ${state.daysRemaining} days left`;
    case "expiring":
      return `Premium, ends in ${state.daysRemaining} day${state.daysRemaining === 1 ? "" : "s"}`;
    case "expired":
      return `Expired ${state.daysAgo} day${state.daysAgo === 1 ? "" : "s"} ago`;
  }
}

export const PLAN_FILTER_KEYS = [
  "all",
  "premium",
  "expiring",
  "expired",
  "free",
  "never_paid",
  "suspended",
] as const;

export type PlanFilterKey = (typeof PLAN_FILTER_KEYS)[number];

/**
 * Database filters behind the admin's plan tabs. They live here, next to
 * `planState`, so the rows a query returns can't drift from the badge each row
 * is rendered with.
 */
export function planFilter(
  key: PlanFilterKey,
  now: Date = new Date(),
): Prisma.StoreWhereInput {
  const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * DAY_MS);

  switch (key) {
    case "premium":
      return {
        plan: PLAN_PREMIUM,
        OR: [{ premiumUntil: null }, { premiumUntil: { gt: now } }],
      };
    case "expiring":
      return { plan: PLAN_PREMIUM, premiumUntil: { gt: now, lte: soon } };
    // Anything whose paid period has run out, whether or not the expiry job
    // has got to it yet.
    case "expired":
      return { premiumUntil: { not: null, lte: now } };
    // Everyone not on premium right now, which includes lapsed stores: they
    // are on the free plan today, whatever they used to be on.
    case "free":
      return { OR: [{ plan: PLAN_FREE }, { premiumUntil: { lte: now } }] };
    /** Never paid at all. Kept apart from `free` for the overview's counts. */
    case "never_paid":
      return { plan: PLAN_FREE, premiumUntil: null };
    case "suspended":
      return { isSuspended: true };
    case "all":
      return {};
  }
}

export function isPlanFilterKey(value: string | undefined): value is PlanFilterKey {
  return Boolean(value) && (PLAN_FILTER_KEYS as readonly string[]).includes(value as string);
}
