-- CreateEnum
CREATE TYPE "public"."PrgiStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."DomainStatus" AS ENUM ('PENDING', 'VERIFYING', 'ACTIVE', 'SUSPENDED', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "public"."ReporterRole" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'ADMIN_EDITOR', 'NEWS_MODERATOR', 'PARENT_REPORTER', 'REPORTER', 'GUEST_REPORTER');

-- CreateEnum
CREATE TYPE "public"."ReporterLevel" AS ENUM ('NATIONAL', 'STATE', 'DISTRICT', 'ASSEMBLY', 'MANDAL');

-- CreateEnum
CREATE TYPE "public"."ReporterPaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'REFUNDED');

-- AlterTable
ALTER TABLE "public"."Article" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "stateId" TEXT,
    "prgiNumber" TEXT NOT NULL,
    "prgiStatus" "public"."PrgiStatus" NOT NULL DEFAULT 'PENDING',
    "prgiSubmittedAt" TIMESTAMP(3),
    "prgiVerifiedAt" TIMESTAMP(3),
    "prgiRejectedAt" TIMESTAMP(3),
    "prgiRejectionReason" TEXT,
    "prgiDocuments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Domain" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."DomainStatus" NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT,
    "verificationMethod" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckAt" TIMESTAMP(3),
    "lastCheckStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DomainCategory" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DomainLanguage" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DomainCheckLog" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL,
    "details" JSONB,

    CONSTRAINT "DomainCheckLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TenantTheme" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT,
    "headerHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Reporter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "role" "public"."ReporterRole" NOT NULL,
    "level" "public"."ReporterLevel",
    "stateId" TEXT,
    "districtId" TEXT,
    "mandalId" TEXT,
    "assemblyId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reporter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReporterIDCard" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReporterIDCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReporterPayment" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "public"."ReporterPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReporterPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserEncryptionKey" (
    "userId" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "signedPreKey" TEXT,
    "signedPreKeySig" TEXT,
    "oneTimePreKeys" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEncryptionKey_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "public"."Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_prgiNumber_key" ON "public"."Tenant"("prgiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_domain_key" ON "public"."Domain"("domain");

-- CreateIndex
CREATE INDEX "DomainCategory_categoryId_idx" ON "public"."DomainCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainCategory_domainId_categoryId_key" ON "public"."DomainCategory"("domainId", "categoryId");

-- CreateIndex
CREATE INDEX "DomainLanguage_languageId_idx" ON "public"."DomainLanguage"("languageId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainLanguage_domainId_languageId_key" ON "public"."DomainLanguage"("domainId", "languageId");

-- CreateIndex
CREATE INDEX "DomainCheckLog_domainId_checkedAt_idx" ON "public"."DomainCheckLog"("domainId", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantTheme_tenantId_key" ON "public"."TenantTheme"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Reporter_email_key" ON "public"."Reporter"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ReporterIDCard_reporterId_key" ON "public"."ReporterIDCard"("reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "ReporterIDCard_cardNumber_key" ON "public"."ReporterIDCard"("cardNumber");

-- CreateIndex
CREATE INDEX "ReporterPayment_status_idx" ON "public"."ReporterPayment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReporterPayment_reporterId_year_key" ON "public"."ReporterPayment"("reporterId", "year");

-- CreateIndex
CREATE INDEX "Article_tenantId_createdAt_idx" ON "public"."Article"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Article" ADD CONSTRAINT "Article_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tenant" ADD CONSTRAINT "Tenant_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Domain" ADD CONSTRAINT "Domain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DomainCategory" ADD CONSTRAINT "DomainCategory_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "public"."Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DomainCategory" ADD CONSTRAINT "DomainCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DomainLanguage" ADD CONSTRAINT "DomainLanguage_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "public"."Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DomainLanguage" ADD CONSTRAINT "DomainLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DomainCheckLog" ADD CONSTRAINT "DomainCheckLog_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "public"."Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantTheme" ADD CONSTRAINT "TenantTheme_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reporter" ADD CONSTRAINT "Reporter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reporter" ADD CONSTRAINT "Reporter_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Reporter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reporter" ADD CONSTRAINT "Reporter_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reporter" ADD CONSTRAINT "Reporter_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "public"."District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reporter" ADD CONSTRAINT "Reporter_mandalId_fkey" FOREIGN KEY ("mandalId") REFERENCES "public"."Mandal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReporterIDCard" ADD CONSTRAINT "ReporterIDCard_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."Reporter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReporterPayment" ADD CONSTRAINT "ReporterPayment_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."Reporter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserEncryptionKey" ADD CONSTRAINT "UserEncryptionKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
