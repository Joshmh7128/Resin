import { describe, it, expect } from "vitest";
import {
  planState,
  isPremiumActive,
  extendPremium,
  PLAN_FREE,
  PLAN_PREMIUM,
  EXPIRING_SOON_DAYS,
} from "@/lib/plan";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * DAY);
}

describe("planState", () => {
  it("reads a store with no premium history as free", () => {
    expect(planState({ plan: PLAN_FREE, premiumUntil: null }, NOW)).toEqual({ status: "free" });
  });

  it("treats premium with no end date as comped, not expired", () => {
    expect(planState({ plan: PLAN_PREMIUM, premiumUntil: null }, NOW)).toEqual({
      status: "lifetime",
    });
  });

  it("separates a comfortable period from one about to run out", () => {
    const comfortable = planState({ plan: PLAN_PREMIUM, premiumUntil: daysFromNow(45) }, NOW);
    expect(comfortable.status).toBe("active");

    const nearly = planState(
      { plan: PLAN_PREMIUM, premiumUntil: daysFromNow(EXPIRING_SOON_DAYS - 1) },
      NOW,
    );
    expect(nearly).toMatchObject({ status: "expiring", daysRemaining: EXPIRING_SOON_DAYS - 1 });
  });

  it("counts a part day as a day remaining rather than none", () => {
    const state = planState({ plan: PLAN_PREMIUM, premiumUntil: daysFromNow(0.25) }, NOW);
    expect(state).toMatchObject({ status: "expiring", daysRemaining: 1 });
  });

  it("expires on the date passing, without waiting for the sweep to run", () => {
    // Still marked premium in the database: the job hasn't been by yet.
    const state = planState({ plan: PLAN_PREMIUM, premiumUntil: daysFromNow(-2) }, NOW);
    expect(state).toMatchObject({ status: "expired", daysAgo: 2 });
  });

  it("still reports a lapse after the sweep has moved the store to free", () => {
    const state = planState({ plan: PLAN_FREE, premiumUntil: daysFromNow(-30) }, NOW);
    expect(state).toMatchObject({ status: "expired", daysAgo: 30 });
  });

  it("does not count a future date as premium once the plan is free", () => {
    // Premium revoked by hand: the end date is in the future but the plan isn't.
    expect(planState({ plan: PLAN_FREE, premiumUntil: daysFromNow(10) }, NOW)).toEqual({
      status: "free",
    });
  });
});

describe("isPremiumActive", () => {
  it("covers every way of being paid up, and nothing else", () => {
    expect(isPremiumActive({ plan: PLAN_PREMIUM, premiumUntil: null }, NOW)).toBe(true);
    expect(isPremiumActive({ plan: PLAN_PREMIUM, premiumUntil: daysFromNow(45) }, NOW)).toBe(true);
    expect(isPremiumActive({ plan: PLAN_PREMIUM, premiumUntil: daysFromNow(1) }, NOW)).toBe(true);

    expect(isPremiumActive({ plan: PLAN_PREMIUM, premiumUntil: daysFromNow(-1) }, NOW)).toBe(false);
    expect(isPremiumActive({ plan: PLAN_FREE, premiumUntil: null }, NOW)).toBe(false);
    expect(isPremiumActive({ plan: PLAN_FREE, premiumUntil: daysFromNow(-1) }, NOW)).toBe(false);
  });

  it("is false the instant the end date passes", () => {
    const until = new Date(NOW.getTime());
    expect(isPremiumActive({ plan: PLAN_PREMIUM, premiumUntil: until }, NOW)).toBe(false);
  });
});

describe("extendPremium", () => {
  it("starts from today for a store that has never paid", () => {
    expect(extendPremium(null, 30, NOW)).toEqual(daysFromNow(30));
  });

  it("adds on top of a period still running, so renewing early costs nothing", () => {
    expect(extendPremium(daysFromNow(10), 30, NOW)).toEqual(daysFromNow(40));
  });

  it("starts again from today for a lapsed store, not from the old end date", () => {
    expect(extendPremium(daysFromNow(-60), 30, NOW)).toEqual(daysFromNow(30));
  });

  it("adds up the same either way round", () => {
    const twice = extendPremium(extendPremium(null, 30, NOW), 60, NOW);
    expect(twice).toEqual(extendPremium(null, 90, NOW));
  });
});
