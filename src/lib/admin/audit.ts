import { prisma } from "@/lib/prisma";

/**
 * Every state-changing admin action is written here.
 *
 * Two things make the trail worth having: it is append-only (nothing in the app
 * updates or deletes a row), and it is denormalised. The admin's email and the
 * store's slug are copied in, so an entry saying who deleted which store still
 * reads correctly once that store is gone and the admin who did it has left.
 */

/** Actor for the scheduled jobs, which have no signed-in admin behind them. */
export const SYSTEM_ACTOR = { id: null, email: "system" } as const;

export type AuditActor = { id: string | null; email: string };

export interface AuditEntry {
  actor: AuditActor;
  /** Dotted, stable, and greppable: "store.premium.grant", "store.delete". */
  action: string;
  store?: { id: string; slug: string } | null;
  /** One line, written for a human skimming the log. */
  summary: string;
  /** Action-specific detail: previous values, days granted, and so on. */
  metadata?: Record<string, unknown>;
}

export async function recordAdminAction(entry: AuditEntry): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: entry.actor.id,
      adminEmail: entry.actor.email,
      action: entry.action,
      targetStoreId: entry.store?.id ?? null,
      targetStoreSlug: entry.store?.slug ?? null,
      summary: entry.summary,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    },
  });
}

/** Parses the stored metadata blob back out for display. */
export function parseAuditMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
