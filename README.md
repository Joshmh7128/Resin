# Resin

Resin connects a record store's Discogs seller inventory to a searchable, paginated
storefront page customers can browse, designed to be linked from a QR code on the
counter or in the crates.

## Stack

- Next.js (App Router) + TypeScript
- Prisma + Postgres (local dev via Docker, [Neon](https://neon.tech) in production)
- Discogs public marketplace API (no OAuth; stores connect by Discogs username)
- Server Actions for auth, settings, sync, and inventory curation
- Deploys to [Render](https://render.com) as a web service. See `render.yaml` and
  the Deployment section below

## Getting started

```bash
npm install
cp .env.example .env          # edit if you're not using the default local Postgres
docker compose up -d          # starts local Postgres on localhost:5433
npx prisma migrate dev
npm run seed                  # optional, creates /store/demo with real synced inventory
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up a store with a real Discogs
username to pull in live inventory.

### Demo store

`prisma/seed.ts` creates a `/store/demo` storefront (linked from the landing page) and
syncs it against a real Discogs seller account, so a fresh database has something to
show immediately. It's idempotent, safe to re-run, and skips the sync if the demo
store already has one. It runs automatically after `prisma migrate reset`, or on demand:

```bash
npm run seed
```

The demo store's password is randomly generated and never surfaced. It's a public
storefront example only, not meant to be logged into.

### Environment variables (`.env`)

See `.env.example` for the full template. Summary:

- `DATABASE_URL`: Postgres connection string. `docker compose up -d` gives you a
  working local one out of the box; production uses a Neon connection string instead.
- `SESSION_SECRET`: random secret used to sign session cookies. **Replace the
  placeholder value before deploying anywhere real** (`openssl rand -base64 32`).
- `NEXT_PUBLIC_BASE_URL` (optional): absolute base URL used when generating the
  storefront QR code. If unset, it's inferred from the request's `Host` header,
  which is fine for local dev but should be set explicitly in production.
- `RESEND_API_KEY` / `MAIL_FROM` (optional): outbound email for password reset
  links and premium expiry notices. Unset, those messages go to the server log
  instead and the admin backend shows reset links on screen.
- `CRON_SECRET` (optional): bearer token for the scheduled plan expiry sweep.
  Unset, `POST /api/admin/premium-expiry` is disabled and the sweep is manual.

## How it works

- **Store accounts** sign up with a name, store URL slug, Discogs username, email,
  and password (`src/lib/actions.ts`, `src/app/signup`, `src/app/login`).
- **Sync** (`src/lib/sync.ts`) pulls the store's public "For Sale" listings from
  Discogs' inventory endpoint and upserts them into a local `InventoryItem` cache,
  removing items no longer for sale.
- **Release lookups** (`src/lib/item-image.ts`) fill in what the inventory endpoint
  leaves out: cover art, genres, styles, label, pressing country and format tags.
  Each release costs a separate request against a throttle of about one per second,
  far too slow to do inline, so a single background worker drains two tiers of work.
  Items a customer is looking at right now always jump the queue; everything else is
  warmed store by store behind them. Both write to the same cache, so browsing also
  advances the warm. `InventoryItem.detailVersion` records which generation of
  release data an item holds, so when a build starts storing something new, already
  looked-up items are revisited rather than left behind.
- **Storefront** (`src/app/store/[slug]`) reads only from the local cache. Search,
  filters, sorting and pagination are all local database queries, so public traffic
  never calls the Discogs API directly. The browse state lives entirely in the query
  string (`src/lib/storefront-query.ts`), so a filtered view can be shared, bookmarked
  and reopened, and it renders on the server with no hydration wait on a phone.
- **Filter options** (`src/lib/facets.ts`) are derived from the shop's own catalogue
  rather than a fixed list, so a soul-only shop is never offered a "Classical" filter
  that returns nothing.
- **Presentation** (`src/lib/theme.ts`) holds every choice a shop can make about how
  its storefront looks: colour theme, title bar, default layout and featured section.
  Themes are applied as a `data-theme` attribute on the storefront wrapper only, so
  the dashboard and marketing pages keep their own styling.
- **Item detail pages** (`src/app/store/[slug]/item/[id]`) lazily fetch and cache
  full release details (genres, styles, tracklist, images, notes) the first time an
  item is viewed.
- **Dashboard** (`src/app/dashboard`) lets a store manage its profile, appearance,
  locations and Discogs connection, trigger syncs, generate its QR code, and
  hide/feature items in bulk without touching the underlying Discogs listings.

## Accounts, plans, and the admin backend

### For store owners

- **Password reset**: `/forgot-password` emails a single-use link that expires in
  an hour. The reply is the same whether or not the address has an account, so
  the form can't be used to find out which shops are on Resin.
- **Account page** (`/dashboard/account`): change the login email (current
  password required), change the password, see the current plan, clear the
  cached inventory, or delete the account. The last two ask for the store's URL
  to be typed out first.

### The admin backend

`/admin` is the operator side: one signed-in admin can see every store, manage
plans, and run the same actions an owner has. It uses its own session cookie and
its own account table, so a store login can never reach it.

There is no admin sign-up page and no admin password reset, on purpose. Admins
are made from the command line, which is also the way back in if the last one is
locked out:

```bash
npm run admin:create -- --email you@example.com --name "Your Name"
```

The first admin created is an `owner`, who can add and deactivate other admins
from `/admin/admins`. Pass `--reset-password` to set a new password for an
existing admin. With no `--password`, one is generated and printed once.

From a store's page in the backend you can: grant or extend premium, set an
end date directly, comp an account with no expiry, move it back to free, run a
sync, reset the inventory cache, change the login email or storefront URL, issue
a password reset link, set a password, clear a login lockout, open the owner's
dashboard for support, suspend, and delete. Every one of those is written to an
append-only audit log at `/admin/audit`, along with the automatic expiries.

### Premium

Payment isn't wired up yet: premium is granted by an operator, and `Store.plan`
plus `Store.premiumUntil` is the whole record of it. Two rules matter:

- **Entitlement is derived, never scheduled.** `isPremiumActive` in
  `src/lib/plan.ts` reads the end date, so a store's premium lapses the moment
  the date passes whether or not any job has run.
- **Granted time is added, not replaced.** Extending an account that still has
  time left pushes the end date out from where it was, so renewing early never
  costs a store the days it already had. A lapsed store starts again from today.

The scheduled sweep is the paperwork around that: it emails stores a week before
their premium ends, moves lapsed ones back to the free plan, and writes the audit
entry. Point a scheduler at it once a day:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain.com/api/admin/premium-expiry
```

It is safe to run late, twice, or not at all for a day, and an admin can run it
by hand from `/admin`.

### Suspension

Suspending a store is the reversible step before deleting one: the owner can't
log in, their storefront 404s, and nothing is deleted. Deleting removes the store
and its cached items; the audit entry recording it stays.

## Deployment (Render + Neon)

1. Create a [Neon](https://neon.tech) project and copy its (pooled) connection string.
2. In [Render](https://render.com), create a new **Blueprint** from this repo. It
   reads `render.yaml` and provisions the web service automatically.
3. Set the environment variables Render leaves blank (marked `sync: false` in
   `render.yaml`): `DATABASE_URL` (the Neon connection string) and
   `NEXT_PUBLIC_BASE_URL` (your Render service URL or custom domain).
   `SESSION_SECRET` is generated automatically.
4. Deploy. The build step runs `prisma migrate deploy` automatically, so the schema
   is applied on every deploy.
5. Seed the demo store once, from your own machine, by pointing `DATABASE_URL` at
   the same Neon database and running `npm run seed` locally. Render's free tier
   can't run one-off shell jobs, but seeding doesn't need to run on Render itself.
6. Create your admin account the same way: point `DATABASE_URL` at the Neon
   database and run `npm run admin:create -- --email you@example.com --name "…"`
   locally, then sign in at `/admin/login`.
7. Optionally point a scheduler at `POST /api/admin/premium-expiry` once a day,
   using the `CRON_SECRET` Render generated. Nothing breaks without it: premium
   still expires on time, but the warning emails and the audit entries don't get
   written until someone runs the sweep from `/admin`.

Render's free tier sleeps after 15 minutes of inactivity (cold start on the next
request); its paid Starter tier removes that entirely if it becomes worth $7/month.

## Notes

- Discogs allows 60 req/min authenticated, 25 req/min unauthenticated. The client in
  `src/lib/discogs.ts` throttles accordingly; adding a Discogs personal access token
  in store settings speeds up sync.
- Purchases happen on Discogs itself. Item pages link out to the live Discogs
  listing rather than handling checkout in-app.
