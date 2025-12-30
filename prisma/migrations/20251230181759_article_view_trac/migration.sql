-- AlterTable
ALTER TABLE "public"."TenantWebArticle" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "TenantWebArticle_tenantId_viewCount_idx" ON "public"."TenantWebArticle"("tenantId", "viewCount");
