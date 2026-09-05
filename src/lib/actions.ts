"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { requireStore } from "@/lib/auth";
import { syncStoreInventory } from "@/lib/sync";
import { verifyDiscogsUsername } from "@/lib/discogs";
import {
  signupSchema,
  loginSchema,
  settingsSchema,
  changePasswordSchema,
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

export async function syncInventoryAction(): Promise<FormState> {
  const safeStore = await requireStore();
  const store = await prisma.store.findUniqueOrThrow({ where: { id: safeStore.id } });
  const result = await syncStoreInventory(store);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/store/${store.slug}`);

  if (!result.ok) {
    return { error: result.error ?? "Sync failed" };
  }
  return {
    success: `Synced ${result.total} listing${result.total === 1 ? "" : "s"} (${result.added} new, ${result.removed} removed)`,
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
