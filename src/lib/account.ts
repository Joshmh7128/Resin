import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

/**
 * Account operations that both an owner (from their own dashboard) and an
 * operator (from the admin backend) can perform.
 *
 * They live here rather than in either set of server actions so the two paths
 * can't drift: an admin resetting a store's inventory does exactly what the
 * owner doing it themselves does. Each returns a result object instead of
 * throwing, because every caller renders the failure back into a form.
 */

export type AccountResult<T = null> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * Empties a store's cached inventory and clears its sync history, so the next
 * sync rebuilds from Discogs as if the store had just signed up.
 *
 * Curation (hidden and featured flags) lives on the item rows and goes with
 * them, which is the point: this is the escape hatch for a cache that has drifted
 * out of step with Discogs, not a tidy-up.
 */
export async function resetStoreInventory(
  storeId: string,
): Promise<AccountResult<{ removed: number }>> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return fail("Store not found.");

  const { count } = await prisma.inventoryItem.deleteMany({ where: { storeId } });

  await prisma.store.update({
    where: { id: storeId },
    data: {
      lastSyncAt: null,
      lastSyncStatus: null,
      lastSyncError: null,
      syncStartedAt: null,
    },
  });

  return { ok: true, value: { removed: count } };
}

/**
 * Deletes a store outright. Inventory items and reset tokens go with it through
 * the cascade; audit entries deliberately do not, since they record that this
 * happened.
 */
export async function deleteStoreAccount(
  storeId: string,
): Promise<AccountResult<{ slug: string; name: string; email: string; removedItems: number }>> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return fail("Store not found.");

  const removedItems = await prisma.inventoryItem.count({ where: { storeId } });
  await prisma.store.delete({ where: { id: storeId } });

  return {
    ok: true,
    value: { slug: store.slug, name: store.name, email: store.email, removedItems },
  };
}

/** Changes the address a store logs in with. */
export async function changeStoreEmail(
  storeId: string,
  email: string,
): Promise<AccountResult<{ previous: string }>> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return fail("Store not found.");

  const normalised = email.trim().toLowerCase();
  if (normalised === store.email) return { ok: true, value: { previous: store.email } };

  const taken = await prisma.store.findUnique({ where: { email: normalised } });
  if (taken) return fail("Another store already uses that email address.");

  await prisma.store.update({ where: { id: storeId }, data: { email: normalised } });
  return { ok: true, value: { previous: store.email } };
}

/** Changes the storefront URL. Old links stop working, so callers warn first. */
export async function changeStoreSlug(
  storeId: string,
  slug: string,
): Promise<AccountResult<{ previous: string }>> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return fail("Store not found.");
  if (slug === store.slug) return { ok: true, value: { previous: store.slug } };

  const taken = await prisma.store.findUnique({ where: { slug } });
  if (taken) return fail("That store URL is already taken.");

  await prisma.store.update({ where: { id: storeId }, data: { slug } });
  return { ok: true, value: { previous: store.slug } };
}

/**
 * Sets a password directly, without the current one. Only reachable from the
 * admin backend and from a redeemed reset link; owners changing their own
 * password go through `changePasswordAction`, which checks the old one.
 */
export async function setStorePassword(
  storeId: string,
  password: string,
): Promise<AccountResult> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return fail("Store not found.");

  await prisma.store.update({
    where: { id: storeId },
    data: {
      passwordHash: await hashPassword(password),
      // Whoever set this password is entitled to use it right away.
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  // Any outstanding reset link is now stale, and leaving it live would let an
  // old email keep changing the password.
  await prisma.passwordResetToken.deleteMany({ where: { storeId, usedAt: null } });

  return { ok: true, value: null };
}

/**
 * Suspends or restores a store. A suspended store can't log in and its
 * storefront 404s, but nothing is deleted, so this is the reversible step to
 * reach for before deleting an account.
 */
export async function setStoreSuspended(
  storeId: string,
  suspended: boolean,
  reason: string | null,
): Promise<AccountResult> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return fail("Store not found.");

  await prisma.store.update({
    where: { id: storeId },
    data: {
      isSuspended: suspended,
      suspendedReason: suspended ? reason : null,
    },
  });

  return { ok: true, value: null };
}

/** Clears a failed-login lockout so an owner doesn't have to wait it out. */
export async function clearLoginLockout(storeId: string): Promise<AccountResult> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return fail("Store not found.");

  await prisma.store.update({
    where: { id: storeId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  return { ok: true, value: null };
}
