-- CreateTable
CREATE TABLE "TenantStaticPage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT,
  "contentHtml" TEXT NOT NULL,
  "meta" JSONB,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantStaticPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantStaticPage_slug_idx" ON "TenantStaticPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantStaticPage_tenantId_slug_key" ON "TenantStaticPage"("tenantId", "slug");

-- AddForeignKey
ALTER TABLE "TenantStaticPage" ADD CONSTRAINT "TenantStaticPage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
