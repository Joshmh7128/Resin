// Diagnostic: a single request, to read back our current rate-limit budget
// without spending much of it.
const UA = "ResinRecordStoreDirectory/1.0 +https://github.com/resin-app";
const res = await fetch("https://api.discogs.com/releases/249504", {
  headers: { "User-Agent": UA },
});
console.log({
  status: res.status,
  used: res.headers.get("x-discogs-ratelimit-used"),
  limit: res.headers.get("x-discogs-ratelimit"),
  remaining: res.headers.get("x-discogs-ratelimit-remaining"),
});
