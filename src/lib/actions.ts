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
import {
  signupSchema,
  loginSchema,
  settingsSchema,
  changePasswordSchema,
  shopDetailsSchema,
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

  const { name, email, password, discogsUsername, slug } = parsed.data;

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

  const { email, password } = parsed.data;
  const store = await prisma.store.findUnique({ where: { email } });
  if (!store) return { error: "Invalid email or password" };

  const valid = await verifyPassword(password, store.passwordHash);
  if (!valid) return { error: "Invalid email or password" };

  await setSessionCookie(store.id);
  redirect("/dashboard");
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
    accentColor: formData.get("accentColor"),
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
      accentColor: data.accentColor,
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
    addressLine: formData.get("addressLine") ?? "",
    city: formData.get("city") ?? "",
    postcode: formData.get("postcode") ?? "",
    country: formData.get("country") ?? "",
    phone: formData.get("phone") ?? "",
    openingHours: formData.get("openingHours") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    instagramUrl: formData.get("instagramUrl") ?? "",
    facebookUrl: formData.get("facebookUrl") ?? "",
    bandcampUrl: formData.get("bandcampUrl") ?? "",
  });

  if (!parsed.success) {
    return { error: firstIssueMessage(parsed.error.issues) };
  }

  // Store blanks as null so the storefront can simply skip empty details.
  const blankToNull = (value?: string) => (value && value.trim() !== "" ? value.trim() : null);
  const d = parsed.data;

  await prisma.store.update({
    where: { id: store.id },
    data: {
      logoUrl: blankToNull(d.logoUrl),
      addressLine: blankToNull(d.addressLine),
      city: blankToNull(d.city),
      postcode: blankToNull(d.postcode),
      country: blankToNull(d.country),
      phone: blankToNull(d.phone),
      openingHours: blankToNull(d.openingHours),
      websiteUrl: blankToNull(d.websiteUrl),
      instagramUrl: blankToNull(d.instagramUrl),
      facebookUrl: blankToNull(d.facebookUrl),
      bandcampUrl: blankToNull(d.bandcampUrl),
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath(`/store/${store.slug}`);
  return { success: "Shop details saved" };
}
