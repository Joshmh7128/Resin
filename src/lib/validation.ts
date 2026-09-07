import { z } from "zod";
import {
  FEATURED_LAYOUT_IDS,
  HEADER_STYLE_IDS,
  LAYOUT_IDS,
  THEME_IDS,
} from "@/lib/theme";

export const slugSchema = z
  .string()
  .min(2, "Must be at least 2 characters")
  .max(50, "Must be 50 characters or fewer")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only");

export const signupSchema = z.object({
  name: z.string().min(2, "Store name is required").max(100),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  discogsUsername: z.string().min(1, "Discogs username is required").max(100),
  slug: slugSchema,
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const settingsSchema = z.object({
  name: z.string().min(2, "Store name is required").max(100),
  slug: slugSchema,
  discogsUsername: z.string().min(1, "Discogs username is required").max(100),
  discogsToken: z.string().max(200).optional().or(z.literal("")),
  currency: z.string().min(1).max(10),
  itemsPerPage: z.coerce.number().int().min(6).max(96),
  description: z.string().max(1000).optional().or(z.literal("")),
});

export const emailSchema = z.string().email("Enter a valid email address");

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This reset link is missing its token"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm the new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changeEmailSchema = z.object({
  email: emailSchema,
  currentPassword: z.string().min(1, "Enter your current password to confirm"),
});

/**
 * Destructive account actions ask for the store's URL to be typed out. The
 * action compares what was typed against the store itself, so all the schema
 * can check is that something was.
 */
export const confirmationSchema = z.object({
  confirmation: z.string().min(1, "Type the store URL to confirm"),
});

// Admin backend.

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const adminUserSchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: emailSchema,
  // Longer than the 8 a store needs: one of these can reach every account.
  password: z.string().min(12, "Admin passwords must be at least 12 characters"),
  role: z.enum(["admin", "owner"]),
});

export const grantPremiumSchema = z.object({
  // Ten years is well past any plausible grant, and stops a typo in the
  // custom-days box from comping an account into the next century.
  days: z.coerce
    .number()
    .int()
    .min(1, "Enter at least 1 day")
    .max(3650, "That is more than 10 years"),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const premiumUntilSchema = z.object({
  // <input type="date"> posts YYYY-MM-DD.
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  note: z.string().max(500).optional().or(z.literal("")),
});

export const suspendSchema = z.object({
  reason: z.string().max(500).optional().or(z.literal("")),
});

export const setPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/** Blank is always allowed: every shop detail is optional. */
const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(""));

/**
 * Only http(s) URLs are accepted. These values are rendered as links on a public
 * page, so allowing arbitrary schemes would let a store put `javascript:` behind
 * a link customers click.
 */
const optionalUrl = (label: string) =>
  z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .url(`Enter a full ${label} address, starting with https://`)
        .refine(
          (value) => /^https?:\/\//i.test(value),
          `Enter a full ${label} address, starting with https://`,
        ),
    ])
    .optional();

export const shopDetailsSchema = z.object({
  logoUrl: optionalUrl("profile picture"),
  bannerUrl: optionalUrl("banner image"),
  aboutText: optionalText(2000),
  websiteUrl: optionalUrl("website"),
  instagramUrl: optionalUrl("Instagram"),
  facebookUrl: optionalUrl("Facebook"),
  bandcampUrl: optionalUrl("Bandcamp"),
  otherUrl: optionalUrl("link"),
  otherLabel: optionalText(30),
});

/**
 * A single trading address. Shops can have several, so this validates one at a
 * time; everything is optional because an online-only shop still wants the rest
 * of its about section.
 */
export const locationSchema = z.object({
  label: optionalText(60),
  addressLine: optionalText(200),
  city: optionalText(100),
  postcode: optionalText(20),
  country: optionalText(100),
  phone: optionalText(40),
  openingHours: optionalText(500),
});

/**
 * How a shop's storefront looks. Each value is checked against the options the
 * app actually implements rather than stored as free text, so a hand-posted
 * form can't leave a store rendering with no theme at all.
 */
const appearanceFields = {
  theme: z.enum(THEME_IDS),
  headerStyle: z.enum(HEADER_STYLE_IDS),
  defaultLayout: z.enum(LAYOUT_IDS),
  featuredLayout: z.enum(FEATURED_LAYOUT_IDS),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #2563eb"),
};

export const appearanceSchema = z.object(appearanceFields);

/**
 * The appearance settings are saved a section at a time, each with its own
 * preview and its own save button, so a form posts only the fields it owns.
 * Anything absent is left alone rather than overwritten with a blank.
 */
export const partialAppearanceSchema = z.object(appearanceFields).partial();

export const APPEARANCE_KEYS = Object.keys(appearanceFields) as (keyof typeof appearanceFields)[];

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm the new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });
