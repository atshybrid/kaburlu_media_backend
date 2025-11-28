-- CreateTable
CREATE TABLE "public"."TenantNavigation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantNavigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TenantFeatureFlags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enableMobileAppView" BOOLEAN NOT NULL DEFAULT false,
    "section2Rows" INTEGER NOT NULL DEFAULT 2,
    "section2ListCount" INTEGER NOT NULL DEFAULT 4,
    "section2ForceCategoryName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantFeatureFlags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TenantHomepageSection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantHomepageSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NewsletterSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantNavigation_tenantId_key" ON "public"."TenantNavigation"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeatureFlags_tenantId_key" ON "public"."TenantFeatureFlags"("tenantId");

-- CreateIndex
CREATE INDEX "TenantHomepageSection_tenantId_sectionName_idx" ON "public"."TenantHomepageSection"("tenantId", "sectionName");

-- CreateIndex
CREATE UNIQUE INDEX "TenantHomepageSection_tenantId_sectionName_key" ON "public"."TenantHomepageSection"("tenantId", "sectionName");

-- CreateIndex
CREATE INDEX "NewsletterSubscription_tenantId_idx" ON "public"."NewsletterSubscription"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscription_tenantId_email_key" ON "public"."NewsletterSubscription"("tenantId", "email");

-- AddForeignKey
ALTER TABLE "public"."TenantNavigation" ADD CONSTRAINT "TenantNavigation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantFeatureFlags" ADD CONSTRAINT "TenantFeatureFlags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantHomepageSection" ADD CONSTRAINT "TenantHomepageSection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NewsletterSubscription" ADD CONSTRAINT "NewsletterSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
