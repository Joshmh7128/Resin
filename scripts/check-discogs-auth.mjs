// Diagnostic: compares the rate-limit ceiling Discogs grants with and without
// the app's consumer key/secret, to confirm key/secret auth actually raises it.
const UA = "ResinRecordStoreDirectory/1.0 +https://github.com/resin-app";
const KEY = process.env.DISCOGS_CONSUMER_KEY;
const SECRET = process.env.DISCOGS_CONSUMER_SECRET;

if (!KEY || !SECRET) {
  console.error("Set DISCOGS_CONSUMER_KEY and DISCOGS_CONSUMER_SECRET");
  process.exit(1);
}

async function probe(label, headers) {
  const res = await fetch("https://api.discogs.com/releases/249504", { headers });
  console.log(label, {
    status: res.status,
    limit: res.headers.get("x-discogs-ratelimit"),
    used: res.headers.get("x-discogs-ratelimit-used"),
    remaining: res.headers.get("x-discogs-ratelimit-remaining"),
  });
}

await probe("unauthenticated:", { "User-Agent": UA });
await new Promise((r) => setTimeout(r, 3000));
await probe("key/secret:    ", {
  "User-Agent": UA,
  Authorization: `Discogs key=${KEY}, secret=${SECRET}`,
});
