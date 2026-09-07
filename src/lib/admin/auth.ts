import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionAdminId } from "@/lib/admin/session";
import type { AdminUser } from "@prisma/client";

export type SafeAdmin = Omit<AdminUser, "passwordHash">;

/** Only an owner can create or deactivate other admins. */
export const ROLE_OWNER = "owner";
export const ROLE_ADMIN = "admin";

function omitPassword(admin: AdminUser): SafeAdmin {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, ...rest } = admin;
  return rest;
}

export async function getCurrentAdmin(): Promise<SafeAdmin | null> {
  const adminUserId = await getSessionAdminId();
  if (!adminUserId) return null;

  const admin = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  // Checked on every request rather than only at login, so deactivating an
  // admin takes effect immediately instead of when their cookie expires.
  if (!admin || !admin.isActive) return null;

  return omitPassword(admin);
}

export async function requireAdmin(): Promise<SafeAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/admin/login");
  }
  return admin;
}

export function isOwner(admin: SafeAdmin): boolean {
  return admin.role === ROLE_OWNER;
}

export async function requireOwner(): Promise<SafeAdmin> {
  const admin = await requireAdmin();
  if (!isOwner(admin)) {
    redirect("/admin");
  }
  return admin;
}
