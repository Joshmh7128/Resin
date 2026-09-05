import { describe, it, expect } from "vitest";
import { withImageSlot } from "@/lib/image-queue";

const MAX_CONCURRENT = 3;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("withImageSlot", () => {
  it("never runs more than the concurrency cap at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const gates = Array.from({ length: 10 }, () => deferred());

    const runs = gates.map((gate) =>
      withImageSlot(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await gate.promise;
        inFlight -= 1;
      }),
    );

    // Let the queue start as many as it is willing to.
    await new Promise((r) => setTimeout(r, 0));
    expect(inFlight).toBe(MAX_CONCURRENT);

    // Release them one at a time; the cap must hold throughout.
    for (const gate of gates) {
      gate.resolve();
      await new Promise((r) => setTimeout(r, 0));
    }

    await Promise.all(runs);
    expect(peak).toBe(MAX_CONCURRENT);
    expect(inFlight).toBe(0);
  });

  it("hands the slot to the next waiter so the queue drains", async () => {
    const order: number[] = [];
    const runs = Array.from({ length: 6 }, (_, i) =>
      withImageSlot(async () => {
        order.push(i);
      }),
    );
    await Promise.all(runs);
    expect(order).toHaveLength(6);
  });

  it("releases the slot even when the task throws", async () => {
    await expect(
      withImageSlot(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    // If the slot leaked, this would hang rather than resolve.
    await expect(withImageSlot(async () => "ok")).resolves.toBe("ok");
  });
});
