import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchReleaseDetails,
  isRateLimited,
  DiscogsError,
  __resetRateLimitForTest,
} from "@/lib/discogs";

const TOKEN = "test-token"; // uses the 1100ms authenticated interval
const AUTHED_INTERVAL_MS = 1100;

const originalFetch = global.fetch;

function releaseBody() {
  return {
    genres: ["Jazz"],
    styles: [],
    images: [{ uri: "https://img.discogs.com/a.jpg", type: "primary" }],
    tracklist: [],
    labels: [],
  };
}

function okResponse() {
  return new Response(JSON.stringify(releaseBody()), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  __resetRateLimitForTest();
});

afterEach(() => {
  global.fetch = originalFetch;
  __resetRateLimitForTest();
});

describe("Discogs throttle", () => {
  it("spaces concurrent requests instead of releasing them in a burst", async () => {
    const callTimes: number[] = [];
    global.fetch = vi.fn(async () => {
      callTimes.push(Date.now());
      return okResponse();
    }) as unknown as typeof fetch;

    // Three callers at once — the exact pattern that previously slipped through
    // the throttle together and got us rate limited.
    await Promise.all([
      fetchReleaseDetails(1, TOKEN),
      fetchReleaseDetails(2, TOKEN),
      fetchReleaseDetails(3, TOKEN),
    ]);

    expect(callTimes).toHaveLength(3);
    callTimes.sort((a, b) => a - b);

    // Each request must be separated by roughly the throttle interval. A little
    // slack for timer jitter, but nowhere near "all at once".
    for (let i = 1; i < callTimes.length; i += 1) {
      const gap = callTimes[i] - callTimes[i - 1];
      expect(gap).toBeGreaterThan(AUTHED_INTERVAL_MS * 0.8);
    }
  }, 15_000);
});

describe("Discogs rate limiting", () => {
  it("throws instead of retrying forever when rate limited", async () => {
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls += 1;
      return new Response("{}", { status: 429, headers: { "retry-after": "1" } });
    }) as unknown as typeof fetch;

    await expect(fetchReleaseDetails(1, TOKEN)).rejects.toBeInstanceOf(DiscogsError);

    // The old implementation recursed on every 429 with no attempt limit.
    expect(calls).toBe(1);
    expect(isRateLimited()).toBe(true);
  }, 15_000);

  it("fails fast during the cooldown without issuing more requests", async () => {
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls += 1;
      return new Response("{}", { status: 429, headers: { "retry-after": "30" } });
    }) as unknown as typeof fetch;

    await expect(fetchReleaseDetails(1, TOKEN)).rejects.toBeInstanceOf(DiscogsError);
    expect(calls).toBe(1);

    // Further requests in the cooldown window must not reach Discogs at all.
    await expect(fetchReleaseDetails(2, TOKEN)).rejects.toBeInstanceOf(DiscogsError);
    await expect(fetchReleaseDetails(3, TOKEN)).rejects.toBeInstanceOf(DiscogsError);
    expect(calls).toBe(1);
  }, 15_000);

  it("resumes normally once the cooldown has passed", async () => {
    global.fetch = vi.fn(async () =>
      new Response("{}", { status: 429, headers: { "retry-after": "0" } }),
    ) as unknown as typeof fetch;

    await expect(fetchReleaseDetails(1, TOKEN)).rejects.toBeInstanceOf(DiscogsError);

    // retry-after: 0 falls back to the default cooldown, so clear it explicitly
    // to represent the window having elapsed.
    __resetRateLimitForTest();
    expect(isRateLimited()).toBe(false);

    global.fetch = vi.fn(async () => okResponse()) as unknown as typeof fetch;
    const details = await fetchReleaseDetails(4, TOKEN);
    expect(details.images).toEqual(["https://img.discogs.com/a.jpg"]);
  }, 15_000);
});
