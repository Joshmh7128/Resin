import { describe, it, expect } from "vitest";
import {
  isLockedOut,
  afterFailedAttempt,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
} from "@/lib/lockout";

const NOW = new Date("2026-06-01T12:00:00.000Z");

describe("login lockout", () => {
  it("counts failures up to the limit without locking", () => {
    let account = { failedLoginAttempts: 0, lockedUntil: null as Date | null };

    for (let attempt = 1; attempt < MAX_FAILED_ATTEMPTS; attempt += 1) {
      account = afterFailedAttempt(account, NOW);
      expect(account.failedLoginAttempts).toBe(attempt);
      expect(isLockedOut(account, NOW)).toBe(false);
    }
  });

  it("locks on the last allowed failure and resets the counter with it", () => {
    const account = afterFailedAttempt(
      { failedLoginAttempts: MAX_FAILED_ATTEMPTS - 1, lockedUntil: null },
      NOW,
    );

    expect(isLockedOut(account, NOW)).toBe(true);
    expect(account.lockedUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_MINUTES * 60 * 1000));
    // Reset, so serving the lockout doesn't leave the account one failure away
    // from the next one.
    expect(account.failedLoginAttempts).toBe(0);
  });

  it("stops being locked once the lock has passed", () => {
    const account = afterFailedAttempt(
      { failedLoginAttempts: MAX_FAILED_ATTEMPTS - 1, lockedUntil: null },
      NOW,
    );
    const later = new Date(NOW.getTime() + (LOCKOUT_MINUTES + 1) * 60 * 1000);

    expect(isLockedOut(account, later)).toBe(false);
  });

  it("treats an account that has never failed as unlocked", () => {
    expect(isLockedOut({ failedLoginAttempts: 0, lockedUntil: null }, NOW)).toBe(false);
  });
});
