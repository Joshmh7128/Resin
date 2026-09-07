/**
 * Login throttling shared by store owners and admins.
 *
 * The counters live on the account row rather than in memory: Render restarts
 * the process on every deploy and spins it down when idle, which would reset an
 * in-memory counter and hand an attacker a fresh budget each time.
 */

/** Failed attempts allowed before an account is locked. */
export const MAX_FAILED_ATTEMPTS = 8;

/** How long a lockout lasts. Long enough to be useless to a script, short
 *  enough that a legitimate owner can wait it out rather than needing support. */
export const LOCKOUT_MINUTES = 15;

export interface LockoutFields {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export function isLockedOut(account: LockoutFields, now: Date = new Date()): boolean {
  return account.lockedUntil !== null && account.lockedUntil.getTime() > now.getTime();
}

/**
 * The counter state to write after a failed attempt. Reaching the limit sets
 * the lock and resets the counter, so the next lockout takes another full run
 * of failures rather than triggering on the very next try.
 */
export function afterFailedAttempt(
  account: LockoutFields,
  now: Date = new Date(),
): LockoutFields {
  const attempts = account.failedLoginAttempts + 1;
  if (attempts < MAX_FAILED_ATTEMPTS) {
    return { failedLoginAttempts: attempts, lockedUntil: null };
  }
  return {
    failedLoginAttempts: 0,
    lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000),
  };
}

export function lockoutMessage(lockedUntil: Date, now: Date = new Date()): string {
  const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000));
  return `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
