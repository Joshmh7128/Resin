import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/auth";
import { parseAuditMetadata } from "@/lib/admin/audit";
import { Pagination } from "@/components/Pagination";

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const q = sp.q?.trim() ?? "";
  const action = sp.action?.trim() ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q, mode: "insensitive" as const } },
            { adminEmail: { contains: q, mode: "insensitive" as const } },
            { targetStoreSlug: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, entries, actions] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    // The action list is built from what has actually been recorded, so it
    // stays right as actions are added without a list to keep in step.
    prisma.adminAuditLog.groupBy({ by: ["action"], _count: true, orderBy: { action: "asc" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Audit log</h1>
        <p className="text-sm text-neutral-500">{total} entries</p>
      </div>
      <p className="text-sm text-neutral-600">
        Every admin action and every automatic plan expiry, oldest at the bottom. Nothing in the
        app edits or removes these.
      </p>

      <form method="GET" action="/admin/audit" className="flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search summary, admin, or store"
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <select
          name="action"
          defaultValue={action}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">All actions</option>
          {actions.map((row) => (
            <option key={row.action} value={row.action}>
              {row.action} ({row._count})
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700"
        >
          Filter
        </button>
      </form>

      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
        {entries.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-neutral-500">Nothing matches.</li>
        )}
        {entries.map((entry) => {
          const metadata = parseAuditMetadata(entry.metadata);
          return (
            <li key={entry.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-neutral-900">{entry.summary}</span>
                <span className="text-xs text-neutral-400">
                  {entry.createdAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                <code>{entry.action}</code> · {entry.adminEmail}
                {entry.targetStoreSlug && (
                  <>
                    {" "}
                    ·{" "}
                    {entry.targetStoreId ? (
                      <Link
                        href={`/admin/stores/${entry.targetStoreId}`}
                        className="underline hover:text-neutral-700"
                      >
                        {entry.targetStoreSlug}
                      </Link>
                    ) : (
                      entry.targetStoreSlug
                    )}
                  </>
                )}
              </p>
              {metadata && (
                <pre className="mt-1 overflow-x-auto rounded bg-neutral-50 px-2 py-1 font-mono text-xs text-neutral-600">
                  {JSON.stringify(metadata)}
                </pre>
              )}
            </li>
          );
        })}
      </ul>

      <Pagination
        basePath="/admin/audit"
        params={{ q, action }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
