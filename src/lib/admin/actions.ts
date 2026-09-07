"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Store } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { requireAdmin, requireOwner, type SafeAdmin } from "@/lib/admin/auth";
import {
  setAdminSessionCookie,
  clearAdminSessionCookie,
} from "@/lib/admin/session";
import { recordAdminAction } from "@/lib/admin/audit";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { startInventorySync } from "@/lib/sync";
import { PLAN_FREE, PLAN_PREMIUM, extendPremium } from "@/lib/plan";
import { runPremiumMaintenance } from "@/lib/premium-expiry";
import { isLockedOut, afterFailedAttempt, lockoutMessage } from "@/lib/lockout";
import {
  resetStoreInventory,
  deleteStoreAccount,
  changeStoreEmail,
  changeStoreSlug,
  setStorePassword,
  setStoreSuspended,
  clearLoginLockout,
} from "@/lib/account";
import {
  createPasswordResetToken,
  passwordResetUrl,
  passwordResetEmail,
} from "@/lib/password-reset";
import { sendMail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/url";
import {
  adminLoginSchema,
  adminUserSchema,
  grantPremiumSchema,
  premiumUntilSchema,
  suspendSchema,
  setPasswordSchema,
  emailSchema,
  slugSchema,
} from "@/lib/validation";

export interface AdminFormState {
  error?: string;
  success?: string;
  /** A generated link (password reset) for the operator to copy and send. */
  link?: string;
}

function firstIssueMessage(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Invalid input";
}

function actorOf(admin: SafeAdmin) {
  return { id: admin.id, email: admin.email };
}

/**
 * Loads the store an action was submitted against.
 *
 * The id comes from a hidden field, so it is checked here rather than trusted;
 * an unknown id is simply reported as a missing store.
 */
async function loadStore(formData: FormData): Promise<Store | null> {
  const storeId = formData.get("storeId");
  if (typeof storeId !== "string" || !storeId) return null;
  return prisma.store.findUnique({ where: { id: storeId } });
}

function revalidateStore(storeId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/stores");
  revalidatePath(`/admin/stores/${storeId}`);
}

// Authentication.

export async function adminLoginAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const email = parsed.data.email.trim().toLowerCase();
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // Same message for every failure, so this page can't be used to find out
  // which addresses are admins.
  const generic = { error: "Invalid email or password" };
  if (!admin || !admin.isActive) return generic;

  if (isLockedOut(admin)) {
    return { error: lockoutMessage(admin.lockedUntil!) };
  }

  const valid = await verifyPassword(parsed.data.password, admin.passwordHash);
  if (!valid) {
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: afterFailedAttempt(admin),
    });
    return generic;
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });

  await setAdminSessionCookie(admin.id);
  await recordAdminAction({
    actor: { id: admin.id, email: admin.email },
    action: "admin.login",
    summary: `${admin.email} signed in to the admin backend`,
  });

  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

// Plan management.

export async function grantPremiumAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const parsed = grantPremiumSchema.safeParse({
    days: formData.get("days"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const now = new Date();
  const until = extendPremium(store.premiumUntil, parsed.data.days, now);

  await prisma.store.update({
    where: { id: store.id },
    data: {
      plan: PLAN_PREMIUM,
      premiumUntil: until,
      premiumSince: store.premiumSince ?? now,
      planNote: parsed.data.note || store.planNote,
      // A fresh period earns a fresh warning email when it runs down.
      expiryNoticeSentAt: null,
    },
  });

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.premium.grant",
    store,
    summary: `Granted ${parsed.data.days} days of premium to ${store.slug}`,
    metadata: {
      days: parsed.data.days,
      previousUntil: store.premiumUntil?.toISOString() ?? null,
      newUntil: until.toISOString(),
      note: parsed.data.note || null,
    },
  });

  revalidateStore(store.id);
  return { success: `Premium now runs to ${until.toISOString().slice(0, 10)}` };
}

export async function setPremiumUntilAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const parsed = premiumUntilSchema.safeParse({
    until: formData.get("until"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  // The date picker gives a day, not an instant. Premium runs to the end of the
  // chosen day so the store isn't cut off that morning.
  const until = new Date(`${parsed.data.until}T23:59:59.999Z`);
  if (Number.isNaN(until.getTime())) return { error: "That date could not be read." };

  await prisma.store.update({
    where: { id: store.id },
    data: {
      plan: PLAN_PREMIUM,
      premiumUntil: until,
      premiumSince: store.premiumSince ?? new Date(),
      planNote: parsed.data.note || store.planNote,
      expiryNoticeSentAt: null,
    },
  });

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.premium.set_date",
    store,
    summary: `Set premium end date for ${store.slug} to ${parsed.data.until}`,
    metadata: {
      previousUntil: store.premiumUntil?.toISOString() ?? null,
      newUntil: until.toISOString(),
      note: parsed.data.note || null,
    },
  });

  revalidateStore(store.id);
  return { success: `Premium now runs to ${parsed.data.until}` };
}

/** Comps an account: premium with no end date, and nothing for the expiry job to do. */
export async function setLifetimePremiumAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const note = formData.get("note");
  await prisma.store.update({
    where: { id: store.id },
    data: {
      plan: PLAN_PREMIUM,
      premiumUntil: null,
      premiumSince: store.premiumSince ?? new Date(),
      planNote: typeof note === "string" && note ? note : store.planNote,
      expiryNoticeSentAt: null,
    },
  });

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.premium.lifetime",
    store,
    summary: `Gave ${store.slug} premium with no expiry`,
    metadata: { previousUntil: store.premiumUntil?.toISOString() ?? null },
  });

  revalidateStore(store.id);
  return { success: "Premium with no expiry" };
}

export async function revokePremiumAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  await prisma.store.update({
    where: { id: store.id },
    // The end date is cleared as well as the plan, so the store reads as plainly
    // free rather than as a lapse the operator still has to look at.
    data: { plan: PLAN_FREE, premiumUntil: null, expiryNoticeSentAt: null },
  });

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.premium.revoke",
    store,
    summary: `Moved ${store.slug} back to the free plan`,
    metadata: { previousUntil: store.premiumUntil?.toISOString() ?? null },
  });

  revalidateStore(store.id);
  return { success: "Moved to the free plan" };
}

// Account actions.

export async function adminSyncStoreAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const result = await startInventorySync(store.id);
  if (!result.started) return { error: result.reason ?? "Could not start sync" };

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.sync",
    store,
    summary: `Started a sync for ${store.slug}`,
  });

  revalidateStore(store.id);
  return { success: "Sync started. It runs in the background." };
}

export async function adminResetInventoryAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  if (formData.get("confirmation") !== store.slug) {
    return { error: `Type "${store.slug}" to confirm.` };
  }

  const result = await resetStoreInventory(store.id);
  if (!result.ok) return { error: result.error };

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.inventory.reset",
    store,
    summary: `Cleared ${result.value.removed} inventory items from ${store.slug}`,
    metadata: { removed: result.value.removed },
  });

  revalidateStore(store.id);
  revalidatePath(`/store/${store.slug}`);
  return {
    success: `Removed ${result.value.removed} items. Run a sync to rebuild from Discogs.`,
  };
}

export async function adminDeleteStoreAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  if (formData.get("confirmation") !== store.slug) {
    return { error: `Type "${store.slug}" to confirm.` };
  }

  const result = await deleteStoreAccount(store.id);
  if (!result.ok) return { error: result.error };

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.delete",
    store,
    summary: `Deleted ${store.slug} (${result.value.email}) and ${result.value.removedItems} items`,
    metadata: {
      email: result.value.email,
      name: result.value.name,
      removedItems: result.value.removedItems,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/stores");
  redirect("/admin/stores?deleted=1");
}

export async function adminChangeEmailAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const result = await changeStoreEmail(store.id, parsed.data);
  if (!result.ok) return { error: result.error };

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.email.change",
    store,
    summary: `Changed the login email for ${store.slug}`,
    metadata: { from: result.value.previous, to: parsed.data.trim().toLowerCase() },
  });

  revalidateStore(store.id);
  return { success: "Login email updated" };
}

export async function adminChangeSlugAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const parsed = slugSchema.safeParse(formData.get("slug"));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const result = await changeStoreSlug(store.id, parsed.data);
  if (!result.ok) return { error: result.error };

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.slug.change",
    store,
    summary: `Changed the storefront URL for ${result.value.previous} to ${parsed.data}`,
    metadata: { from: result.value.previous, to: parsed.data },
  });

  revalidateStore(store.id);
  revalidatePath(`/store/${result.value.previous}`);
  revalidatePath(`/store/${parsed.data}`);
  return { success: `Storefront now at /store/${parsed.data}. The old link no longer works.` };
}

export async function adminSetPasswordAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const parsed = setPasswordSchema.safeParse({ newPassword: formData.get("newPassword") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const result = await setStorePassword(store.id, parsed.data.newPassword);
  if (!result.ok) return { error: result.error };

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.password.set",
    store,
    summary: `Set a new password for ${store.slug}`,
  });

  revalidateStore(store.id);
  return {
    success: "Password set. Tell the owner over a channel you trust, and ask them to change it.",
  };
}

/**
 * Issues a reset link rather than setting a password, which is the better
 * default: the operator never learns the store's password, and the link expires
 * on its own. It is emailed if a mail provider is configured, and returned here
 * either way so it can be sent by hand.
 */
export async function adminIssueResetLinkAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const { token } = await createPasswordResetToken(store.id, { issuedByAdminId: admin.id });
  const url = passwordResetUrl(await getBaseUrl(), token);
  const mail = await sendMail({ to: store.email, ...passwordResetEmail(store.name, url) });

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.password.reset_link",
    store,
    summary: `Issued a password reset link for ${store.slug}`,
    metadata: { emailed: mail.delivered, transport: mail.transport },
  });

  return {
    success: mail.delivered
      ? `Emailed a reset link to ${store.email}. It expires in an hour.`
      : "No mail provider is configured, so nothing was sent. Copy the link below.",
    link: url,
  };
}

export async function adminToggleSuspendAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const parsed = suspendSchema.safeParse({ reason: formData.get("reason") ?? "" });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const suspend = !store.isSuspended;
  const result = await setStoreSuspended(store.id, suspend, parsed.data.reason || null);
  if (!result.ok) return { error: result.error };

  await recordAdminAction({
    actor: actorOf(admin),
    action: suspend ? "store.suspend" : "store.restore",
    store,
    summary: suspend ? `Suspended ${store.slug}` : `Restored ${store.slug}`,
    metadata: { reason: parsed.data.reason || null },
  });

  revalidateStore(store.id);
  revalidatePath(`/store/${store.slug}`);
  return {
    success: suspend
      ? "Suspended. The owner can't log in and the storefront is hidden."
      : "Restored. The owner can log in again.",
  };
}

export async function adminClearLockoutAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  const result = await clearLoginLockout(store.id);
  if (!result.ok) return { error: result.error };

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.lockout.clear",
    store,
    summary: `Cleared the login lockout on ${store.slug}`,
  });

  revalidateStore(store.id);
  return { success: "Lockout cleared" };
}

/**
 * Opens the owner's dashboard as them, for support: seeing what they see beats
 * asking for screenshots. The store session is short-lived, carries the admin's
 * id so the dashboard can show whose session it is, and is logged before it
 * starts.
 */
export async function impersonateStoreAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const store = await loadStore(formData);
  if (!store) return { error: "Store not found." };

  await recordAdminAction({
    actor: actorOf(admin),
    action: "store.impersonate",
    store,
    summary: `${admin.email} opened the dashboard as ${store.slug}`,
  });

  await setSessionCookie(store.id, { impersonatedByAdminId: admin.id });
  redirect("/dashboard");
}

/** Ends an impersonated session and goes back to the store's admin page. */
export async function stopImpersonatingAction(): Promise<void> {
  const admin = await requireAdmin();
  await clearSessionCookie();
  redirect(`/admin/stores?impersonation=ended&by=${encodeURIComponent(admin.email)}`);
}

/**
 * Runs the expiry sweep on demand. The same job a scheduler calls, exposed here
 * so an operator can see the effect of a lapse straight away rather than
 * waiting for the next scheduled run.
 */
// The unused parameters are the shape `useActionState` calls an action with.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function runPremiumMaintenanceAction(_prev: AdminFormState, _formData: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const result = await runPremiumMaintenance();

  await recordAdminAction({
    actor: actorOf(admin),
    action: "premium.maintenance.run",
    summary: `Ran the plan expiry sweep: ${result.expired} expired, ${result.warned} warned`,
    metadata: { expired: result.expiredStores, warned: result.warnedStores },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/stores");
  return {
    success: `Expired ${result.expired} store${result.expired === 1 ? "" : "s"}, warned ${result.warned}.`,
  };
}

// Admin users. Owners only.

export async function createAdminUserAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const owner = await requireOwner();

  const parsed = adminUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return { error: "An admin with that email already exists." };

  const created = await prisma.adminUser.create({
    data: {
      name: parsed.data.name,
      email,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  await recordAdminAction({
    actor: actorOf(owner),
    action: "admin.create",
    summary: `Created ${parsed.data.role} account for ${email}`,
    metadata: { adminUserId: created.id, role: parsed.data.role },
  });

  revalidatePath("/admin/admins");
  return { success: `Created ${email}` };
}

export async function setAdminActiveAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const owner = await requireOwner();

  const adminUserId = formData.get("adminUserId");
  if (typeof adminUserId !== "string") return { error: "Admin not found." };

  const target = await prisma.adminUser.findUnique({ where: { id: adminUserId } });
  if (!target) return { error: "Admin not found." };
  // Locking yourself out is never what you meant, and with one owner it could
  // leave nobody able to manage admins at all.
  if (target.id === owner.id) return { error: "You can't deactivate your own account." };

  const isActive = !target.isActive;
  await prisma.adminUser.update({ where: { id: target.id }, data: { isActive } });

  await recordAdminAction({
    actor: actorOf(owner),
    action: isActive ? "admin.activate" : "admin.deactivate",
    summary: `${isActive ? "Reactivated" : "Deactivated"} ${target.email}`,
    metadata: { adminUserId: target.id },
  });

  revalidatePath("/admin/admins");
  return { success: `${isActive ? "Reactivated" : "Deactivated"} ${target.email}` };
}

/** Changes the signed-in admin's own password. */
export async function changeAdminPasswordAction(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const full = await prisma.adminUser.findUniqueOrThrow({ where: { id: admin.id } });

  const currentPassword = formData.get("currentPassword");
  if (typeof currentPassword !== "string" || !currentPassword) {
    return { error: "Current password is required" };
  }

  const parsed = adminUserSchema.shape.password.safeParse(formData.get("newPassword"));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const valid = await verifyPassword(currentPassword, full.passwordHash);
  if (!valid) return { error: "Current password is incorrect" };

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(parsed.data) },
  });

  await recordAdminAction({
    actor: actorOf(admin),
    action: "admin.password.change",
    summary: `${admin.email} changed their own password`,
  });

  return { success: "Password updated" };
}
