"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";
import {
  bulkUpdateItemsAction,
  toggleItemVisibilityAction,
  toggleItemFeaturedAction,
  type BulkItemAction,
} from "@/lib/actions";

export interface InventoryRow {
  id: string;
  title: string;
  artist: string;
  condition: string | null;
  price: number | null;
  priceCurrency: string | null;
  imageUrl: string | null;
  thumbUrl: string | null;
  isVisible: boolean;
  isFeatured: boolean;
}

const BULK_ACTIONS: { key: BulkItemAction; label: string }[] = [
  { key: "show", label: "Show" },
  { key: "hide", label: "Hide" },
  { key: "feature", label: "Feature" },
  { key: "unfeature", label: "Unfeature" },
];

function Toggle({
  id,
  active,
  action,
  labelOn,
  labelOff,
}: {
  id: string;
  active: boolean;
  action: (id: string) => Promise<void>;
  labelOn: string;
  labelOff: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => action(id))}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
        active
          ? "bg-green-100 text-green-800 hover:bg-green-200"
          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
      }`}
    >
      {active ? labelOn : labelOff}
    </button>
  );
}

export function InventoryTable({ items }: { items: InventoryRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const allSelected = useMemo(
    () => items.length > 0 && items.every((i) => selected.has(i.id)),
    [items, selected],
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  function runBulk(action: BulkItemAction) {
    const ids = [...selected];
    setMessage(null);
    startTransition(async () => {
      const result = await bulkUpdateItemsAction(ids, action);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: result.success ?? "Updated" });
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Only takes up space once something is selected. */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-neutral-900">
            {selected.size} selected
          </span>
          <div className="flex flex-wrap gap-2">
            {BULK_ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                disabled={pending}
                onClick={() => runBulk(action.key)}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-sm text-neutral-500 underline"
          >
            Clear
          </button>
        </div>
      )}

      {message && (
        <p
          className={`text-sm ${message.type === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {message.text}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all items on this page"
                  className="h-4 w-4 rounded border-neutral-300"
                />
              </th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Condition</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Visible</th>
              <th className="px-4 py-3">Featured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {items.map((item) => {
              const image = item.thumbUrl ?? item.imageUrl;
              const isSelected = selected.has(item.id);
              return (
                <tr key={item.id} className={isSelected ? "bg-neutral-50" : undefined}>
                  <td className="px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(item.id)}
                      aria-label={`Select ${item.title}`}
                      className="h-4 w-4 rounded border-neutral-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt=""
                          loading="lazy"
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-neutral-100" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-neutral-900">{item.title}</p>
                        <p className="truncate text-neutral-500">{item.artist}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {item.condition ?? "Not listed"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatPrice(item.price, item.priceCurrency)}
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      id={item.id}
                      active={item.isVisible}
                      action={toggleItemVisibilityAction}
                      labelOn="Visible"
                      labelOff="Hidden"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Toggle
                      id={item.id}
                      active={item.isFeatured}
                      action={toggleItemFeaturedAction}
                      labelOn="Featured"
                      labelOff="Not featured"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
