import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/password";
import {
  createPasswordResetToken,
  resolvePasswordResetToken,
  consumePasswordResetToken,
  passwordResetUrl,
} from "@/lib/password-reset";

const STORE_SLUG = "reset-test-store";
let storeId: string;

beforeAll(async () => {
  await prisma.store.deleteMany({ where: { slug: STORE_SLUG } });
  const store = await prisma.store.create({
    data: {
      slug: STORE_SLUG,
      name: "Reset Test Store",
      email: "reset-test@example.com",
      passwordHash: await hashPassword("original-password"),
      discogsUsername: "example",
    },
  });
  storeId = store.id;
});

afterAll(async () => {
  await prisma.store.deleteMany({ where: { slug: STORE_SLUG } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.passwordResetToken.deleteMany({ where: { storeId } });
  await prisma.store.update({
    where: { id: storeId },
    data: {
      passwordHash: await hashPassword("original-password"),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
});

describe("password reset tokens", () => {
  it("never stores the token itself", async () => {
    const { token } = await createPasswordResetToken(storeId);
    const rows = await prisma.passwordResetToken.findMany({ where: { storeId } });

    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("resolves a fresh token to its store", async () => {
    const { token } = await createPasswordResetToken(storeId);
    expect(await resolvePasswordResetToken(token)).toEqual({
      storeId,
      email: "reset-test@example.com",
    });
  });

  it("rejects a token that was never issued", async () => {
    expect(await resolvePasswordResetToken("not-a-real-token")).toBeNull();
  });

  it("supersedes the previous link when another is issued", async () => {
    const first = await createPasswordResetToken(storeId);
    const second = await createPasswordResetToken(storeId);

    expect(await resolvePasswordResetToken(first.token)).toBeNull();
    expect(await resolvePasswordResetToken(second.token)).not.toBeNull();
  });

  it("rejects an expired token", async () => {
    const { token } = await createPasswordResetToken(storeId);
    await prisma.passwordResetToken.updateMany({
      where: { storeId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await resolvePasswordResetToken(token)).toBeNull();
  });

  it("sets the new password and burns the token", async () => {
    const { token } = await createPasswordResetToken(storeId);

    const result = await consumePasswordResetToken(token, "a-brand-new-password");
    expect(result).toEqual({ ok: true, storeId });

    const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(await verifyPassword("a-brand-new-password", store.passwordHash)).toBe(true);
    expect(await verifyPassword("original-password", store.passwordHash)).toBe(false);
  });

  it("clears a login lockout, since that is who needs a reset", async () => {
    await prisma.store.update({
      where: { id: storeId },
      data: { failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) },
    });

    const { token } = await createPasswordResetToken(storeId);
    await consumePasswordResetToken(token, "a-brand-new-password");

    const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(store.lockedUntil).toBeNull();
    expect(store.failedLoginAttempts).toBe(0);
  });

  it("cannot be redeemed twice", async () => {
    const { token } = await createPasswordResetToken(storeId);
    await consumePasswordResetToken(token, "first-new-password");

    const second = await consumePasswordResetToken(token, "second-new-password");
    expect(second.ok).toBe(false);

    const store = await prisma.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(await verifyPassword("first-new-password", store.passwordHash)).toBe(true);
  });

  it("only lets one of two racing redemptions through", async () => {
    const { token } = await createPasswordResetToken(storeId);

    const results = await Promise.all([
      consumePasswordResetToken(token, "password-from-tab-one"),
      consumePasswordResetToken(token, "password-from-tab-two"),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  it("builds a link the reset page can read", () => {
    expect(passwordResetUrl("https://resin.example.com/", "abc123")).toBe(
      "https://resin.example.com/reset-password?token=abc123",
    );
  });
});
