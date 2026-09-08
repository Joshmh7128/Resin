import { describe, it, expect } from "vitest";
import { storeMeta } from "@/lib/format";

describe("storeMeta", () => {
  it("pluralises the record count", () => {
    expect(storeMeta(0, null)).toBe("0 records");
    expect(storeMeta(1, null)).toBe("1 record");
    expect(storeMeta(2, null)).toBe("2 records");
  });

  it("groups thousands, since shops routinely hold four figures", () => {
    expect(storeMeta(1504, null)).toBe("1,504 records");
  });

  it("omits the sync clause entirely for a shop that has never synced", () => {
    // A dangling "· updated" with nothing after it is worse than saying nothing.
    expect(storeMeta(12, null)).toBe("12 records");
  });

  it("appends when the last sync happened", () => {
    const anHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(storeMeta(12, anHourAgo)).toBe("12 records · updated 1 hour ago");
  });
});
