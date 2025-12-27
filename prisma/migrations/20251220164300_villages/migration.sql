-- AlterTable
ALTER TABLE "public"."TenantFeatureFlags" ADD COLUMN     "aiArticleRewriteEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."Village" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mandalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Village_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Village_tenantId_idx" ON "public"."Village"("tenantId");

-- CreateIndex
CREATE INDEX "Village_mandalId_idx" ON "public"."Village"("mandalId");

-- CreateIndex
CREATE INDEX "Village_name_idx" ON "public"."Village"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Village_tenantId_mandalId_name_key" ON "public"."Village"("tenantId", "mandalId", "name");

-- AddForeignKey
ALTER TABLE "public"."Village" ADD CONSTRAINT "Village_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Village" ADD CONSTRAINT "Village_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "public"."Mandal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
