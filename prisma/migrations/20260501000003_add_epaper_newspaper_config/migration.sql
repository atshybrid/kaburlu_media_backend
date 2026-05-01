-- CreateTable
CREATE TABLE "public"."EpaperNewspaperConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paperType" TEXT NOT NULL DEFAULT 'BROADSHEET',
    "pageCount" INTEGER NOT NULL DEFAULT 8,
    "perPageCost" DOUBLE PRECISION,
    "mainLogoUrl" TEXT,
    "subHeaderLogoUrl" TEXT,
    "headerStyleNumber" INTEGER NOT NULL DEFAULT 1,
    "subHeaderStyleNumber" INTEGER NOT NULL DEFAULT 1,
    "prgiNumber" TEXT,
    "lastPageFooterText" TEXT,
    "volumeStartNumber" INTEGER NOT NULL DEFAULT 1,
    "volumeStartDate" DATE NOT NULL,
    "issueStartNumber" INTEGER NOT NULL DEFAULT 1,
    "issueStartDate" DATE NOT NULL,
    "newsCloseTime" TEXT NOT NULL DEFAULT '23:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperNewspaperConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EpaperNewspaperConfig_tenantId_key" ON "public"."EpaperNewspaperConfig"("tenantId");

-- CreateIndex
CREATE INDEX "EpaperNewspaperConfig_tenantId_idx" ON "public"."EpaperNewspaperConfig"("tenantId");

-- AddForeignKey
ALTER TABLE "public"."EpaperNewspaperConfig" ADD CONSTRAINT "EpaperNewspaperConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
