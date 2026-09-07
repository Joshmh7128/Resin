-- Records the generation of release data held on each item.
--
-- The release lookup only ever ran once per item, so items looked up by an
-- earlier build would never gain the pressing country, label and format tags
-- the new browse filters rely on. Existing rows stay at 0, which is below the
-- current DETAIL_VERSION, so the background warm revisits them at its usual low
-- priority and fills those in.
ALTER TABLE "InventoryItem" ADD COLUMN "detailVersion" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "InventoryItem_storeId_detailVersion_idx"
  ON "InventoryItem"("storeId", "detailVersion");
