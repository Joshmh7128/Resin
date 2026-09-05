import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionStoreId } from "@/lib/session";
import type { Store } from "@prisma/client";

export type SafeStore = Omit<Store, "passwordHash">;

function omitPassword(store: Store): SafeStore {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, ...rest } = store;
  return rest;
}

export async function getCurrentStore(): Promise<SafeStore | null> {
  const storeId = await getSessionStoreId();
  if (!storeId) return null;
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return null;
  return omitPassword(store);
}

export async function requireStore(): Promise<SafeStore> {
  const store = await getCurrentStore();
  if (!store) {
    redirect("/login");
  }
  return store;
}
