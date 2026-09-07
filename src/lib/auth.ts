import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { Store } from "@prisma/client";

export type SafeStore = Omit<Store, "passwordHash">;

export interface StoreSession {
  store: SafeStore;
  /** The admin viewing this dashboard as the owner, if anyone is. */
  impersonatedBy: { id: string; email: string } | null;
}

function omitPassword(store: Store): SafeStore {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, ...rest } = store;
  return rest;
}

export async function getStoreSession(): Promise<StoreSession | null> {
  const session = await getSession();
  if (!session) return null;

  const store = await prisma.store.findUnique({ where: { id: session.storeId } });
  if (!store) return null;

  const admin = session.impersonatedByAdminId
    ? await prisma.adminUser.findUnique({
        where: { id: session.impersonatedByAdminId },
        select: { id: true, email: true, isActive: true },
      })
    : null;

  return {
    store: omitPassword(store),
    // An admin who has since been deactivated stops counting as one, so the
    // banner can't keep offering a way back into the backend.
    impersonatedBy: admin?.isActive ? { id: admin.id, email: admin.email } : null,
  };
}

export async function getCurrentStore(): Promise<SafeStore | null> {
  return (await getStoreSession())?.store ?? null;
}

export async function requireStoreSession(): Promise<StoreSession> {
  const session = await getStoreSession();
  if (!session) {
    redirect("/login");
  }
  // Checked on every dashboard request rather than only at login, so suspending
  // a store also ends the session it already had open.
  if (session.store.isSuspended) {
    redirect("/account-suspended");
  }
  return session;
}

export async function requireStore(): Promise<SafeStore> {
  return (await requireStoreSession()).store;
}
