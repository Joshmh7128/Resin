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
