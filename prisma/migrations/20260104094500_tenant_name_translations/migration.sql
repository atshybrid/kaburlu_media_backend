-- CreateTable
CREATE TABLE "TenantTranslation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantTranslation_tenantId_language_key" ON "TenantTranslation"("tenantId", "language");

-- CreateIndex
CREATE INDEX "TenantTranslation_language_idx" ON "TenantTranslation"("language");

-- AddForeignKey
ALTER TABLE "TenantTranslation" ADD CONSTRAINT "TenantTranslation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
