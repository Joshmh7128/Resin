"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { requireStore } from "@/lib/auth";
import { startInventorySync, isSyncRunning } from "@/lib/sync";
import { getImageProgress, type ImageProgress } from "@/lib/item-image";
import { verifyDiscogsUsername } from "@/lib/discogs";
import { isLockedOut, afterFailedAttempt, lockoutMessage } from "@/lib/lockout";
import { resetStoreInventory, deleteStoreAccount, changeStoreEmail } from "@/lib/account";
import {
  createPasswordResetToken,
  consumePasswordResetToken,
  passwordResetUrl,
  passwordResetEmail,
} from "@/lib/password-reset";
import { sendMail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/url";
import {
  signupSchema,
  loginSchema,
  settingsSchema,
  changePasswordSchema,
  changeEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  shopDetailsSchema,
  partialAppearanceSchema,
  APPEARANCE_KEYS,
  locationSchema,
} from "@/lib/validation";

export interface FormState {
  error?: string;
  success?: string;
}

function firstIssueMessage(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Invalid input";
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    discogsUsername: formData.get("discogsUsername"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error.issues) };
  }

  const { name, password, discogsUsername, slug } = parsed.data;
  // Stored lower-cased so the login lookup, which is case-sensitive in
  // Postgres, matches however the owner types their address later.
  const email = parsed.data.email.trim().toLowerCase();

  const [existingEmail, existingSlug] = await Promise.all([
    prisma.store.findUnique({ where: { email } }),
    prisma.store.findUnique({ where: { slug } }),
  ]);
  if (existingEmail) return { error: "An account with that email already exists" };
  if (existingSlug) return { error: "That store URL is already taken" };

  const usernameValid = await verifyDiscogsUsername(discogsUsername, null);
  if (!usernameValid) {
    return { error: "That Discogs username could not be found" };
  }

  const passwordHash = await hashPassword(password);
  const store = await prisma.store.create({
    data: { name, email, passwordHash, discogsUsername, slug },
  });

  await setSessionCookie(store.id);
  redirect("/dashboard");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error.issues) };
  }

  const { password } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();
  const store = await prisma.store.findUnique({ where: { email } });
  if (!store) return { error: "Invalid email or password" };

  if (isLockedOut(store) && store.lockedUntil) {
    return { error: lockoutMessage(store.lockedUntil) };
  }

  const valid = await verifyPassword(password, store.passwordHash);
  if (!valid) {
    await prisma.store.update({ where: { id: store.id }, data: afterFailedAttempt(store) });
    return { error: "Invalid email or password" };
  }

  // Checked after the password, so a suspension can't be discovered by anyone
  // who doesn't already have the account's credentials.
  if (store.isSuspended) {
    return {
      error: store.suspendedReason
        ? `This account is suspended: ${store.suspendedReason}`
        : "This account is suspended. Get in touch if you think that's a mistake.",
    };
  }

  await prisma.store.update({
    where: { id: store.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
  });

  await setSessionCookie(store.id);
  redirect("/dashboard");
}

/**
 * Starts a password reset. Always reports success, whether or not the address
 * belongs to a store: the reply to this form is public, and saying "no such
 * account" would turn it into a way to test which shops are on Resin.
 */
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const email = parsed.data.email.trim().toLowerCase();
  const store = await prisma.store.findUnique({ where: { email } });

  if (store && !store.isSuspended) {
    const { token } = await createPasswordResetToken(store.id);
    const url = passwordResetUrl(await getBaseUrl(), token);
    await sendMail({ to: store.email, ...passwordResetEmail(store.name, url) });
  }

  return {
    success:
      "If that address has an account, a reset link is on its way. It expires in an hour.",
  };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const result = await consumePasswordResetToken(parsed.data.token, parsed.data.newPassword);
  if (!result.ok) return { error: result.error };

  redirect("/login?reset=1");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function updateSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await requireStore();

  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    discogsUsername: formData.get("discogsUsername"),
    discogsToken: formData.get("discogsToken") ?? "",
    currency: formData.get("currency"),
    itemsPerPage: formData.get("itemsPerPage"),
    description: formData.get("description") ?? "",
  });

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error.issues) };
  }

  const data = parsed.data;

  if (data.slug !== store.slug) {
    const existingSlug = await prisma.store.findUnique({ where: { slug: data.slug } });
    if (existingSlug) return { error: "That store URL is already taken" };
  }

  if (data.discogsUsername !== store.discogsUsername) {
    const usernameValid = await verifyDiscogsUsername(
      data.discogsUsername,
      data.discogsToken || null,
    );
    if (!usernameValid) return { error: "That Discogs username could not be found" };
  }

  await prisma.store.update({
    where: { id: store.id },
    data: {
      name: data.name,
      slug: data.slug,
      discogsUsername: data.discogsUsername,
      discogsToken: data.discogsToken || null,
      currency: data.currency,
      itemsPerPage: data.itemsPerPage,
      description: data.description || null,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath(`/store/${data.slug}`);
  return { success: "Settings saved" };
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await requireStore();
  const full = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error.issues) };
  }

  const valid = await verifyPassword(parsed.data.currentPassword, full.passwordHash);
  if (!valid) return { error: "Current password is incorrect" };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.store.update({ where: { id: store.id }, data: { passwordHash } });

  return { success: "Password updated" };
}

export interface SyncStatus {
  running: boolean;
  status: string | null;
  lastSyncAt: string | null;
  error: string | null;
  totalItems: number;
  visibleItems: number;
  /** Progress of the background cover-art fill for this store. */
  images: ImageProgress;
}

/**
 * Starts a sync and returns straight away. The sync itself takes 40-60s, which
 * exceeds Render's ~15s request timeout, so the client polls
 * `getSyncStatusAction` instead of holding a request open.
 */
export async function syncInventoryAction(): Promise<FormState> {
  const store = await requireStore();
  const result = await startInventorySync(store.id);

  if (!result.started) {
    return { error: result.reason ?? "Could not start sync" };
  }
  return { success: "Sync started" };
}

export async function getSyncStatusAction(): Promise<SyncStatus> {
  const safeStore = await requireStore();
  const [store, totalItems, visibleItems, images] = await Promise.all([
    prisma.store.findUniqueOrThrow({ where: { id: safeStore.id } }),
    prisma.inventoryItem.count({ where: { storeId: safeStore.id } }),
    prisma.inventoryItem.count({ where: { storeId: safeStore.id, isVisible: true } }),
    getImageProgress(safeStore.id),
  ]);

  return {
    running: isSyncRunning(store),
    status: store.lastSyncStatus,
    lastSyncAt: store.lastSyncAt?.toISOString() ?? null,
    error: store.lastSyncError,
    totalItems,
    visibleItems,
    images,
  };
}

export async function toggleItemVisibilityAction(itemId: string): Promise<void> {
  const store = await requireStore();
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, storeId: store.id } });
  if (!item) return;
  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: { isVisible: !item.isVisible },
  });
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/store/${store.slug}`);
}

export async function toggleItemFeaturedAction(itemId: string): Promise<void> {
  const store = await requireStore();
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, storeId: store.id } });
  if (!item) return;
  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: { isFeatured: !item.isFeatured },
  });
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/store/${store.slug}`);
}

/**
 * Changes the address the owner logs in with. The current password is required:
 * this is the one setting that decides where a reset link goes, so a borrowed
 * session shouldn't be able to change it.
 */
export async function changeEmailAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await requireStore();
  const full = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });

  const parsed = changeEmailSchema.safeParse({
    email: formData.get("email"),
    currentPassword: formData.get("currentPassword"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error.issues) };

  const valid = await verifyPassword(parsed.data.currentPassword, full.passwordHash);
  if (!valid) return { error: "Current password is incorrect" };

  const result = await changeStoreEmail(store.id, parsed.data.email);
  if (!result.ok) return { error: result.error };

  revalidatePath("/dashboard/account");
  return { success: "Login email updated" };
}

/**
 * Clears the store's cached listings so the next sync rebuilds from scratch.
 * Nothing on Discogs is touched, but hidden and featured flags go with the
 * items, so the owner has to type their store URL to confirm.
 */
export async function resetInventoryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await requireStore();

  if (formData.get("confirmation") !== store.slug) {
    return { error: `Type "${store.slug}" to confirm.` };
  }

  const result = await resetStoreInventory(store.id);
  if (!result.ok) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/store/${store.slug}`);
  return {
    success: `Removed ${result.value.removed} items. Run a sync to pull them back from Discogs.`,
  };
}

/** Deletes the store and everything cached for it. Password plus slug required. */
export async function deleteAccountAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await requireStore();
  const full = await prisma.store.findUniqueOrThrow({ where: { id: store.id } });

  const currentPassword = formData.get("currentPassword");
  if (typeof currentPassword !== "string" || !currentPassword) {
    return { error: "Enter your password to confirm" };
  }
  if (formData.get("confirmation") !== store.slug) {
    return { error: `Type "${store.slug}" to confirm.` };
  }

  const valid = await verifyPassword(currentPassword, full.passwordHash);
  if (!valid) return { error: "Password is incorrect" };

  const result = await deleteStoreAccount(store.id);
  if (!result.ok) return { error: result.error };

  await clearSessionCookie();
  redirect("/?deleted=1");
}

export type BulkItemAction = "show" | "hide" | "feature" | "unfeature";

const BULK_ACTION_DATA: Record<BulkItemAction, { isVisible?: boolean; isFeatured?: boolean }> = {
  show: { isVisible: true },
  hide: { isVisible: false },
  feature: { isFeatured: true },
  unfeature: { isFeatured: false },
};

/**
 * Applies one change to many items at once. Managing a 1,500 item catalogue a
 * click at a time isn't realistic, and Discogs' own inventory tools offer bulk
 * changes.
 */
export async function bulkUpdateItemsAction(
  itemIds: string[],
  action: BulkItemAction,
): Promise<FormState> {
  const store = await requireStore();

  const data = BULK_ACTION_DATA[action];
  if (!data) return { error: "Unknown action" };
  if (itemIds.length === 0) return { error: "No items selected" };

  // Scoped to this store, so a crafted id list can't touch another store's items.
  const result = await prisma.inventoryItem.updateMany({
    where: { id: { in: itemIds }, storeId: store.id },
    data,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath(`/store/${store.slug}`);

  const verb =
    action === "show"
      ? "shown"
      : action === "hide"
        ? "hidden"
        : action === "feature"
          ? "featured"
          : "unfeatured";
  return {
    success: `${result.count} item${result.count === 1 ? "" : "s"} ${verb}`,
  };
}

export async function updateShopDetailsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await requireStore();

  const parsed = shopDetailsSchema.safeParse({
    logoUrl: formData.get("logoUrl") ?? "",
    bannerUrl: formData.get("bannerUrl") ?? "",
    aboutText: formData.get("aboutText") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    instagramUrl: formData.get("instagramUrl") ?? "",
    facebookUrl: formData.get("facebookUrl") ?? "",
    bandcampUrl: formData.get("bandcampUrl") ?? "",
    otherUrl: formData.get("otherUrl") ?? "",
    otherLabel: formData.get("otherLabel") ?? "",
  });

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error.issues) };
  }

  const d = parsed.data;

  await prisma.store.update({
    where: { id: store.id },
    data: {
      logoUrl: blankToNull(d.logoUrl),
      bannerUrl: blankToNull(d.bannerUrl),
      aboutText: blankToNull(d.aboutText),
      websiteUrl: blankToNull(d.websiteUrl),
      instagramUrl: blankToNull(d.instagramUrl),
      facebookUrl: blankToNull(d.facebookUrl),
      bandcampUrl: blankToNull(d.bandcampUrl),
      otherUrl: blankToNull(d.otherUrl),
      // A label with no link behind it would never be shown, so drop it.
      otherLabel: d.otherUrl ? blankToNull(d.otherLabel) : null,
    },
  });

  revalidateStore(store.slug);
  return { success: "Saved. Your storefront is updated." };
}

/** Blank fields are stored as null so the storefront can simply skip them. */
function blankToNull(value?: string | null): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

function revalidateStore(slug: string) {
  revalidatePath("/dashboard/settings");
  revalidatePath(`/store/${slug}`);
}

export async function updateAppearanceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await requireStore();

  // Each appearance section is its own form with its own save button, so only
  // the fields that form owns are posted. Anything absent is left as it is
  // rather than being blanked by a save from another section.
  const submitted: Record<string, unknown> = {};
  for (const key of APPEARANCE_KEYS) {
    const value = formData.get(key);
    if (typeof value === "string") submitted[key] = value;
  }

  if (Object.keys(submitted).length === 0) {
    return { error: "Nothing to save" };
  }

  const parsed = partialAppearanceSchema.safeParse(submitted);
  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error.issues) };
  }

  await prisma.store.update({ where: { id: store.id }, data: parsed.data });

  revalidateStore(store.slug);
  return { success: "Saved. Your storefront is updated." };
}

/**
 * Creates a location, or updates one when `locationId` is present.
 *
 * The id is checked against this store rather than trusted, so a posted form
 * can't edit another shop's address.
 */
export async function saveLocationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const store = await requireStore();

  const parsed = locationSchema.safeParse({
    label: formData.get("label") ?? "",
    addressLine: formData.get("addressLine") ?? "",
    city: formData.get("city") ?? "",
    postcode: formData.get("postcode") ?? "",
    country: formData.get("country") ?? "",
    phone: formData.get("phone") ?? "",
    openingHours: formData.get("openingHours") ?? "",
  });

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error.issues) };
  }

  const d = parsed.data;
  const data = {
    label: blankToNull(d.label),
    addressLine: blankToNull(d.addressLine),
    city: blankToNull(d.city),
    postcode: blankToNull(d.postcode),
    country: blankToNull(d.country),
    phone: blankToNull(d.phone),
    openingHours: blankToNull(d.openingHours),
  };

  if (Object.values(data).every((value) => value === null)) {
    return { error: "Fill in at least one detail for this location" };
  }

  const locationId = formData.get("locationId");

  if (typeof locationId === "string" && locationId) {
    const updated = await prisma.storeLocation.updateMany({
      where: { id: locationId, storeId: store.id },
      data,
    });
    if (updated.count === 0) return { error: "That location no longer exists" };
    revalidateStore(store.slug);
    return { success: "Location saved" };
  }

  const count = await prisma.storeLocation.count({ where: { storeId: store.id } });
  if (count >= 10) {
    return { error: "You can list up to 10 locations" };
  }

  await prisma.storeLocation.create({
    data: { ...data, storeId: store.id, sortOrder: count },
  });

  revalidateStore(store.slug);
  return { success: "Location added" };
}

export async function deleteLocationAction(locationId: string): Promise<void> {
  const store = await requireStore();
  await prisma.storeLocation.deleteMany({ where: { id: locationId, storeId: store.id } });
  revalidateStore(store.slug);
}
