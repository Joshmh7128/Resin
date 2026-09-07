import { planState, planLabel, type PlanFields } from "@/lib/plan";

const TONE: Record<string, string> = {
  free: "bg-neutral-100 text-neutral-600",
  lifetime: "bg-violet-100 text-violet-700",
  active: "bg-green-100 text-green-700",
  expiring: "bg-amber-100 text-amber-800",
  expired: "bg-red-100 text-red-700",
};

/** The one place a plan is turned into something to look at. */
export function PlanBadge({ store, now }: { store: PlanFields; now?: Date }) {
  const state = planState(store, now);
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[state.status]}`}
    >
      {planLabel(state)}
    </span>
  );
}

export function SuspendedBadge() {
  return (
    <span className="inline-block rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white">
      Suspended
    </span>
  );
}
