-- CreateTable
CREATE TABLE "HomepageSectionConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domainId" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "style" TEXT NOT NULL DEFAULT 'cards',
    "categoryId" TEXT,
    "categorySlug" TEXT,
    "articleLimit" INTEGER NOT NULL DEFAULT 6,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSectionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageSectionConfig_tenantId_domainId_key_key" ON "HomepageSectionConfig"("tenantId", "domainId", "key");

-- CreateIndex
CREATE INDEX "HomepageSectionConfig_tenantId_domainId_position_idx" ON "HomepageSectionConfig"("tenantId", "domainId", "position");

-- CreateIndex
CREATE INDEX "HomepageSectionConfig_categoryId_idx" ON "HomepageSectionConfig"("categoryId");

-- AddForeignKey
ALTER TABLE "HomepageSectionConfig" ADD CONSTRAINT "HomepageSectionConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSectionConfig" ADD CONSTRAINT "HomepageSectionConfig_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageSectionConfig" ADD CONSTRAINT "HomepageSectionConfig_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
