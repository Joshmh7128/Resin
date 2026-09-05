"use client";

import { useTransition } from "react";

export function ToggleSwitch({
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
      className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50 ${
        active
          ? "bg-green-100 text-green-800 hover:bg-green-200"
          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
      }`}
    >
      {active ? labelOn : labelOff}
    </button>
  );
}
