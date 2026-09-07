-- Store presentation options.
ALTER TABLE "Store"
  ADD COLUMN "theme"          TEXT NOT NULL DEFAULT 'light',
  ADD COLUMN "headerStyle"    TEXT NOT NULL DEFAULT 'compact',
  ADD COLUMN "defaultLayout"  TEXT NOT NULL DEFAULT 'grid',
  ADD COLUMN "featuredLayout" TEXT NOT NULL DEFAULT 'carousel',
  ADD COLUMN "bannerUrl"      TEXT,
  ADD COLUMN "aboutText"      TEXT;

-- Locations become their own rows so a shop can have more than one.
CREATE TABLE "StoreLocation" (
    "id"           TEXT NOT NULL,
    "storeId"      TEXT NOT NULL,
    "label"        TEXT,
    "addressLine"  TEXT,
    "city"         TEXT,
    "postcode"     TEXT,
    "country"      TEXT,
    "phone"        TEXT,
    "openingHours" TEXT,
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoreLocation_storeId_sortOrder_idx" ON "StoreLocation"("storeId", "sortOrder");

ALTER TABLE "StoreLocation"
  ADD CONSTRAINT "StoreLocation_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry each store's existing single address across before the columns go, so
-- shops that already filled in their details don't silently lose them.
INSERT INTO "StoreLocation" (
    "id", "storeId", "addressLine", "city", "postcode", "country", "phone",
    "openingHours", "sortOrder", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "id",
    "addressLine",
    "city",
    "postcode",
    "country",
    "phone",
    "openingHours",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Store"
WHERE "addressLine" IS NOT NULL
   OR "city" IS NOT NULL
   OR "postcode" IS NOT NULL
   OR "country" IS NOT NULL
   OR "phone" IS NOT NULL
   OR "openingHours" IS NOT NULL;

-- Now safe to remove the single-location columns.
ALTER TABLE "Store"
  DROP COLUMN "addressLine",
  DROP COLUMN "city",
  DROP COLUMN "postcode",
  DROP COLUMN "country",
  DROP COLUMN "phone",
  DROP COLUMN "openingHours";
