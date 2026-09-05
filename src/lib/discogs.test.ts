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

describe("Discogs authentication", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  async function captureAuthHeader(token?: string | null): Promise<string | undefined> {
    let seen: string | undefined;
    global.fetch = vi.fn(async (_url: unknown, init?: { headers?: Record<string, string> }) => {
      seen = init?.headers?.Authorization;
      return okResponse();
    }) as unknown as typeof fetch;

    await fetchReleaseDetails(1, token);
    return seen;
  }

  it("authenticates with the app's consumer key/secret when configured", async () => {
    process.env.DISCOGS_CONSUMER_KEY = "app-key";
    process.env.DISCOGS_CONSUMER_SECRET = "app-secret";

    expect(await captureAuthHeader(null)).toBe("Discogs key=app-key, secret=app-secret");
  }, 15_000);

  it("prefers a store's own token over the app credentials", async () => {
    process.env.DISCOGS_CONSUMER_KEY = "app-key";
    process.env.DISCOGS_CONSUMER_SECRET = "app-secret";

    expect(await captureAuthHeader("store-token")).toBe("Discogs token=store-token");
  }, 15_000);

  it("sends no Authorization header when nothing is configured", async () => {
    delete process.env.DISCOGS_CONSUMER_KEY;
    delete process.env.DISCOGS_CONSUMER_SECRET;

    expect(await captureAuthHeader(null)).toBeUndefined();
  }, 15_000);

  it("uses the faster authenticated spacing once app credentials are set", async () => {
    process.env.DISCOGS_CONSUMER_KEY = "app-key";
    process.env.DISCOGS_CONSUMER_SECRET = "app-secret";

    const callTimes: number[] = [];
    global.fetch = vi.fn(async () => {
      callTimes.push(Date.now());
      return okResponse();
    }) as unknown as typeof fetch;

    // Unauthenticated spacing is 2800ms; authenticated is 1100ms. Two requests
    // must therefore land well inside the unauthenticated interval.
    await Promise.all([fetchReleaseDetails(1, null), fetchReleaseDetails(2, null)]);

    const gap = callTimes[1] - callTimes[0];
    expect(gap).toBeGreaterThan(AUTHED_INTERVAL_MS * 0.8);
    expect(gap).toBeLessThan(2500);
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
