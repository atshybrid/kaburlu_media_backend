-- This migration was added to create missing ePaper publication catalog + PDF issue tables.

-- CreateTable
CREATE TABLE "public"."EpaperPublicationEdition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "stateId" TEXT,
    "coverImageUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperPublicationEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EpaperPublicationSubEdition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "districtId" TEXT,
    "coverImageUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperPublicationSubEdition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EpaperPdfIssue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "editionId" TEXT,
    "subEditionId" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperPdfIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EpaperPdfPage" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpaperPdfPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpaperPublicationEdition_tenantId_idx" ON "public"."EpaperPublicationEdition"("tenantId");

-- CreateIndex
CREATE INDEX "EpaperPublicationEdition_stateId_idx" ON "public"."EpaperPublicationEdition"("stateId");

-- CreateIndex
CREATE INDEX "EpaperPublicationEdition_isActive_isDeleted_idx" ON "public"."EpaperPublicationEdition"("isActive", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "EpaperPublicationEdition_tenantId_slug_key" ON "public"."EpaperPublicationEdition"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "EpaperPublicationSubEdition_tenantId_idx" ON "public"."EpaperPublicationSubEdition"("tenantId");

-- CreateIndex
CREATE INDEX "EpaperPublicationSubEdition_editionId_idx" ON "public"."EpaperPublicationSubEdition"("editionId");

-- CreateIndex
CREATE INDEX "EpaperPublicationSubEdition_districtId_idx" ON "public"."EpaperPublicationSubEdition"("districtId");

-- CreateIndex
CREATE INDEX "EpaperPublicationSubEdition_isActive_isDeleted_idx" ON "public"."EpaperPublicationSubEdition"("isActive", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "EpaperPublicationSubEdition_editionId_slug_key" ON "public"."EpaperPublicationSubEdition"("editionId", "slug");

-- CreateIndex
CREATE INDEX "EpaperPdfIssue_tenantId_issueDate_idx" ON "public"."EpaperPdfIssue"("tenantId", "issueDate");

-- CreateIndex
CREATE INDEX "EpaperPdfIssue_editionId_idx" ON "public"."EpaperPdfIssue"("editionId");

-- CreateIndex
CREATE INDEX "EpaperPdfIssue_subEditionId_idx" ON "public"."EpaperPdfIssue"("subEditionId");

-- CreateIndex
CREATE UNIQUE INDEX "EpaperPdfIssue_tenantId_issueDate_editionId_key" ON "public"."EpaperPdfIssue"("tenantId", "issueDate", "editionId");

-- CreateIndex
CREATE UNIQUE INDEX "EpaperPdfIssue_tenantId_issueDate_subEditionId_key" ON "public"."EpaperPdfIssue"("tenantId", "issueDate", "subEditionId");

-- CreateIndex
CREATE INDEX "EpaperPdfPage_issueId_idx" ON "public"."EpaperPdfPage"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "EpaperPdfPage_issueId_pageNumber_key" ON "public"."EpaperPdfPage"("issueId", "pageNumber");

-- AddForeignKey
ALTER TABLE "public"."EpaperPublicationEdition" ADD CONSTRAINT "EpaperPublicationEdition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperPublicationEdition" ADD CONSTRAINT "EpaperPublicationEdition_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperPublicationSubEdition" ADD CONSTRAINT "EpaperPublicationSubEdition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperPublicationSubEdition" ADD CONSTRAINT "EpaperPublicationSubEdition_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "public"."EpaperPublicationEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperPublicationSubEdition" ADD CONSTRAINT "EpaperPublicationSubEdition_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "public"."District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperPdfIssue" ADD CONSTRAINT "EpaperPdfIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperPdfIssue" ADD CONSTRAINT "EpaperPdfIssue_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "public"."EpaperPublicationEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperPdfIssue" ADD CONSTRAINT "EpaperPdfIssue_subEditionId_fkey" FOREIGN KEY ("subEditionId") REFERENCES "public"."EpaperPublicationSubEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EpaperPdfPage" ADD CONSTRAINT "EpaperPdfPage_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."EpaperPdfIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
