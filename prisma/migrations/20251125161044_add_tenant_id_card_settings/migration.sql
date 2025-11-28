-- CreateTable
CREATE TABLE "public"."TenantIdCardSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL DEFAULT 'STYLE_1',
    "frontLogoUrl" TEXT,
    "roundStampUrl" TEXT,
    "signUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "termsJson" JSONB,
    "officeAddress" TEXT,
    "helpLine1" TEXT,
    "helpLine2" TEXT,
    "validityType" TEXT NOT NULL DEFAULT 'PER_USER_DAYS',
    "validityDays" INTEGER,
    "fixedValidUntil" TIMESTAMP(3),
    "idPrefix" TEXT,
    "idDigits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantIdCardSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantIdCardSettings_tenantId_key" ON "public"."TenantIdCardSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "public"."TenantIdCardSettings" ADD CONSTRAINT "TenantIdCardSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
