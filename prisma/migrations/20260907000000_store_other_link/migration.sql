-- One free-form link, for shops that sell or post somewhere we don't have a
-- field for (Etsy, eBay, a Linktree, a label site). The label is optional; the
-- storefront falls back to the link's own domain.
ALTER TABLE "Store"
  ADD COLUMN "otherUrl"   TEXT,
  ADD COLUMN "otherLabel" TEXT;
