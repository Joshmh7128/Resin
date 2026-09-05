# Resin

Resin connects a record store's Discogs seller inventory to a searchable, paginated
storefront page customers can browse — designed to be linked from a QR code on the
counter or in the crates.

## Stack

- Next.js (App Router) + TypeScript
- Prisma + SQLite
- Discogs public marketplace API (no OAuth — stores connect by Discogs username)
- Server Actions for auth, settings, sync, and inventory curation

## Getting started

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up a store with a real Discogs
username to pull in live inventory.

### Demo store

`prisma/seed.ts` creates a `/store/demo` storefront (linked from the landing page) and
syncs it against a real Discogs seller account, so a fresh database has something to
show immediately. It's idempotent — safe to re-run, and skips the sync if the demo
store already has one. It runs automatically after `prisma migrate reset`, or on demand:

```bash
npm run seed
```

The demo store's password is randomly generated and never surfaced — it's a public
storefront example only, not meant to be logged into.

### Environment variables (`.env`)

- `DATABASE_URL` — SQLite file path (defaults to `file:./dev.db`)
- `SESSION_SECRET` — random secret used to sign session cookies. **Replace the
  placeholder value before deploying anywhere real.**
- `NEXT_PUBLIC_BASE_URL` (optional) — absolute base URL used when generating the
  storefront QR code. If unset, it's inferred from the request's `Host` header,
  which is fine for local dev but should be set explicitly in production.

## How it works

- **Store accounts** sign up with a name, store URL slug, Discogs username, email,
  and password (`src/lib/actions.ts`, `src/app/signup`, `src/app/login`).
- **Sync** (`src/lib/sync.ts`) pulls the store's public "For Sale" listings from
  Discogs' inventory endpoint and upserts them into a local `InventoryItem` cache,
  removing items no longer for sale. Cover art is usually missing from the listing
  endpoint, so a bounded background pass (`backfillThumbnails`) fetches full release
  images for the newest items after each sync without blocking the sync response or
  hammering Discogs' rate limit.
- **Storefront** (`src/app/store/[slug]`) reads only from the local cache — search,
  sort, and pagination are all local SQLite queries, so public traffic never calls
  the Discogs API directly.
- **Item detail pages** (`src/app/store/[slug]/item/[id]`) lazily fetch and cache
  full release details (genres, styles, tracklist, images, notes) the first time an
  item is viewed.
- **Dashboard** (`src/app/dashboard`) lets a store manage its profile/branding,
  Discogs connection, trigger syncs, generate its QR code, and hide/feature
  individual items without touching the underlying Discogs listings.

## Notes

- Discogs allows 60 req/min authenticated, 25 req/min unauthenticated. The client in
  `src/lib/discogs.ts` throttles accordingly; adding a Discogs personal access token
  in store settings speeds up sync.
- Purchases happen on Discogs itself — item pages link out to the live Discogs
  listing rather than handling checkout in-app.
