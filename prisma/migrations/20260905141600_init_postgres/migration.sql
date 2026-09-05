-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "discogsUsername" TEXT NOT NULL,
    "discogsToken" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "itemsPerPage" INTEGER NOT NULL DEFAULT 24,
    "logoUrl" TEXT,
    "description" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#2563eb',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "listingId" BIGINT NOT NULL,
    "releaseId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "label" TEXT,
    "catalogNumber" TEXT,
    "format" TEXT,
    "formatDescriptions" TEXT,
    "genres" TEXT,
    "styles" TEXT,
    "year" INTEGER,
    "country" TEXT,
    "condition" TEXT,
    "sleeveCondition" TEXT,
    "price" DOUBLE PRECISION,
    "priceCurrency" TEXT,
    "comments" TEXT,
    "imageUrl" TEXT,
    "thumbUrl" TEXT,
    "discogsUri" TEXT,
    "releaseUri" TEXT,
    "status" TEXT,
    "searchText" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "rawData" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_slug_key" ON "Store"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Store_email_key" ON "Store"("email");

-- CreateIndex
CREATE INDEX "Store_discogsUsername_idx" ON "Store"("discogsUsername");

-- CreateIndex
CREATE INDEX "InventoryItem_storeId_isVisible_idx" ON "InventoryItem"("storeId", "isVisible");

-- CreateIndex
CREATE INDEX "InventoryItem_storeId_isFeatured_idx" ON "InventoryItem"("storeId", "isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_storeId_listingId_key" ON "InventoryItem"("storeId", "listingId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
