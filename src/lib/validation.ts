import { z } from "zod";

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
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #2563eb"),
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
  logoUrl: optionalUrl("logo image"),
  addressLine: optionalText(200),
  city: optionalText(100),
  postcode: optionalText(20),
  country: optionalText(100),
  phone: optionalText(40),
  openingHours: optionalText(500),
  websiteUrl: optionalUrl("website"),
  instagramUrl: optionalUrl("Instagram"),
  facebookUrl: optionalUrl("Facebook"),
  bandcampUrl: optionalUrl("Bandcamp"),
});

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
