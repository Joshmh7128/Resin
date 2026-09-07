import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

/**
 * Reset links are short-lived on purpose: they are the one credential that
 * arrives in plain text over email, and a store owner following one acts on it
 * within minutes.
 */
export const RESET_TOKEN_TTL_MINUTES = 60;

/**
 * Only the hash of a reset token is stored, the same way passwords are, so a
 * dump of this table can't be redeemed against any account.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedResetToken {
  token: string;
  expiresAt: Date;
}

/**
 * Issues a reset link for a store, replacing any it already had.
 *
 * Superseding old tokens means a second "forgot password" click can't leave two
 * live links floating around, and it gives an owner who suspects someone else
 * requested one a way to invalidate it.
 */
export async function createPasswordResetToken(
  storeId: string,
  options: { issuedByAdminId?: string | null } = {},
): Promise<IssuedResetToken> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({ where: { storeId, usedAt: null } });
  await prisma.passwordResetToken.create({
    data: {
      storeId,
      tokenHash: hashToken(token),
      expiresAt,
      issuedByAdminId: options.issuedByAdminId ?? null,
    },
  });

  // Opportunistic cleanup, so spent and stale rows don't accumulate forever.
  // Nothing depends on it having run, so failures are not worth surfacing.
  await prisma.passwordResetToken
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } })
    .catch(() => {});

  return { token, expiresAt };
}

/** The store a token belongs to, or null if it is unknown, spent, or expired. */
export async function resolvePasswordResetToken(
  token: string,
): Promise<{ storeId: string; email: string } | null> {
  if (!token) return null;

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { store: { select: { id: true, email: true } } },
  });

  if (!row || row.usedAt !== null || row.expiresAt.getTime() <= Date.now()) return null;
  return { storeId: row.store.id, email: row.store.email };
}

export type ConsumeResult =
  | { ok: true; storeId: string }
  | { ok: false; error: string };

/**
 * Sets a new password from a reset link and burns the token.
 *
 * The update and the burn happen in one transaction, so a token can't be
 * redeemed twice by two requests racing each other. Resetting the password also
 * clears any login lockout, since an owner locked out by failed attempts is
 * exactly who needs this.
 */
export async function consumePasswordResetToken(
  token: string,
  newPassword: string,
): Promise<ConsumeResult> {
  const tokenHash = hashToken(token);
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!row || row.usedAt !== null || row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: "That reset link is invalid or has expired." };
  }

  const passwordHash = await hashPassword(newPassword);

  const burned = await prisma.$transaction(async (tx) => {
    const claim = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claim.count === 0) return false;

    await tx.store.update({
      where: { id: row.storeId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });
    return true;
  });

  if (!burned) {
    return { ok: false, error: "That reset link has already been used." };
  }

  return { ok: true, storeId: row.storeId };
}

export function passwordResetUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

export function passwordResetEmail(storeName: string, url: string): { subject: string; text: string } {
  return {
    subject: "Reset your Resin password",
    text: [
      `Hi ${storeName},`,
      "",
      "Someone asked to reset the password on your Resin account. Follow this link",
      "to choose a new one:",
      "",
      url,
      "",
      `The link works once and expires in ${RESET_TOKEN_TTL_MINUTES} minutes.`,
      "If you didn't ask for this, you can ignore this email; your password stays",
      "as it is.",
    ].join("\n"),
  };
}
