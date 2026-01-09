-- ePaper Module Migration
-- Add this to your database manually or fix the migration history issue

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Category of ePaper block template
CREATE TYPE "EpaperBlockCategory" AS ENUM ('HEADER', 'CONTENT', 'FOOTER');

-- Sub-category for more specific block types
CREATE TYPE "EpaperBlockSubCategory" AS ENUM (
  'MAIN_HEADER',
  'INNER_HEADER',
  'COL_2',
  'COL_4',
  'COL_6',
  'COL_10',
  'COL_12',
  'STANDARD_FOOTER',
  'LAST_PAGE_FOOTER'
);

-- Status of ePaper block template
CREATE TYPE "EpaperBlockStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- Status of ePaper edition generation
CREATE TYPE "EpaperEditionStatus" AS ENUM ('DRAFT', 'GENERATING', 'GENERATED', 'PUBLISHED', 'FAILED');

-- ============================================================================
-- TABLES
-- ============================================================================

-- EpaperBlockTemplate: Reusable block templates for newspaper design
CREATE TABLE "EpaperBlockTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "EpaperBlockCategory" NOT NULL,
    "subCategory" "EpaperBlockSubCategory" NOT NULL,
    "columns" INTEGER NOT NULL,
    "widthInches" DOUBLE PRECISION NOT NULL,
    "minHeightInches" DOUBLE PRECISION,
    "maxHeightInches" DOUBLE PRECISION NOT NULL,
    "components" JSONB NOT NULL,
    "previewImageUrl" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "status" "EpaperBlockStatus" NOT NULL DEFAULT 'DRAFT',
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperBlockTemplate_pkey" PRIMARY KEY ("id")
);

-- EpaperSettings: Per-tenant ePaper configuration
CREATE TABLE "EpaperSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pageWidthInches" DOUBLE PRECISION NOT NULL DEFAULT 13,
    "pageHeightInches" DOUBLE PRECISION NOT NULL DEFAULT 22,
    "gridColumns" INTEGER NOT NULL DEFAULT 12,
    "paddingTop" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "paddingRight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "paddingBottom" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "paddingLeft" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "defaultPageCount" INTEGER NOT NULL DEFAULT 8,
    "mainHeaderTemplateId" TEXT,
    "mainHeaderHeightInches" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "innerHeaderTemplateId" TEXT,
    "innerHeaderHeightInches" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "footerTemplateId" TEXT,
    "footerHeightInches" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "footerStyle" TEXT NOT NULL DEFAULT 'dots',
    "showPrinterInfoOnLastPage" BOOLEAN NOT NULL DEFAULT true,
    "printerName" TEXT,
    "printerAddress" TEXT,
    "printerCity" TEXT,
    "publisherName" TEXT,
    "editorName" TEXT,
    "ownerName" TEXT,
    "rniNumber" TEXT,
    "lastPageFooterTemplate" TEXT,
    "generationConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperSettings_pkey" PRIMARY KEY ("id")
);

-- EpaperEdition: Daily ePaper edition for a tenant
CREATE TABLE "EpaperEdition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "editionDate" DATE NOT NULL,
    "editionNumber" INTEGER,
    "totalPages" INTEGER NOT NULL DEFAULT 8,
    "status" "EpaperEditionStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "pdfGeneratedAt" TIMESTAMP(3),
    "thumbnailUrl" TEXT,
    "generatedAt" TIMESTAMP(3),
    "generatedBy" TEXT,
    "generationLog" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperEdition_pkey" PRIMARY KEY ("id")
);

-- EpaperPageLayout: Computed layout positions for each block
CREATE TABLE "EpaperPageLayout" (
    "id" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "articleId" TEXT,
    "blockTemplateId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "renderedContent" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHeader" BOOLEAN NOT NULL DEFAULT false,
    "isFooter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperPageLayout_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- ADD COLUMNS TO NewspaperArticle
-- ============================================================================

ALTER TABLE "NewspaperArticle" ADD COLUMN "featuredImageUrl" TEXT;
ALTER TABLE "NewspaperArticle" ADD COLUMN "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "NewspaperArticle" ADD COLUMN "suggestedBlockTemplateId" TEXT;
ALTER TABLE "NewspaperArticle" ADD COLUMN "assignedBlockTemplateId" TEXT;
ALTER TABLE "NewspaperArticle" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "NewspaperArticle" ADD COLUMN "isBreaking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NewspaperArticle" ADD COLUMN "charCount" INTEGER;
ALTER TABLE "NewspaperArticle" ADD COLUMN "wordCount" INTEGER;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- EpaperBlockTemplate indexes
CREATE UNIQUE INDEX "EpaperBlockTemplate_code_key" ON "EpaperBlockTemplate"("code");
CREATE INDEX "EpaperBlockTemplate_category_idx" ON "EpaperBlockTemplate"("category");
CREATE INDEX "EpaperBlockTemplate_subCategory_idx" ON "EpaperBlockTemplate"("subCategory");
CREATE INDEX "EpaperBlockTemplate_tenantId_idx" ON "EpaperBlockTemplate"("tenantId");
CREATE INDEX "EpaperBlockTemplate_status_idx" ON "EpaperBlockTemplate"("status");

-- EpaperSettings indexes
CREATE UNIQUE INDEX "EpaperSettings_tenantId_key" ON "EpaperSettings"("tenantId");
CREATE INDEX "EpaperSettings_tenantId_idx" ON "EpaperSettings"("tenantId");

-- EpaperEdition indexes
CREATE UNIQUE INDEX "EpaperEdition_tenantId_editionDate_key" ON "EpaperEdition"("tenantId", "editionDate");
CREATE INDEX "EpaperEdition_tenantId_idx" ON "EpaperEdition"("tenantId");
CREATE INDEX "EpaperEdition_editionDate_idx" ON "EpaperEdition"("editionDate");
CREATE INDEX "EpaperEdition_status_idx" ON "EpaperEdition"("status");

-- EpaperPageLayout indexes
CREATE INDEX "EpaperPageLayout_editionId_idx" ON "EpaperPageLayout"("editionId");
CREATE INDEX "EpaperPageLayout_pageNumber_idx" ON "EpaperPageLayout"("pageNumber");
CREATE INDEX "EpaperPageLayout_articleId_idx" ON "EpaperPageLayout"("articleId");
CREATE INDEX "EpaperPageLayout_blockTemplateId_idx" ON "EpaperPageLayout"("blockTemplateId");

-- NewspaperArticle new indexes
CREATE INDEX "NewspaperArticle_suggestedBlockTemplateId_idx" ON "NewspaperArticle"("suggestedBlockTemplateId");
CREATE INDEX "NewspaperArticle_assignedBlockTemplateId_idx" ON "NewspaperArticle"("assignedBlockTemplateId");
CREATE INDEX "NewspaperArticle_priority_idx" ON "NewspaperArticle"("priority");
CREATE INDEX "NewspaperArticle_status_idx" ON "NewspaperArticle"("status");

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

-- EpaperBlockTemplate
ALTER TABLE "EpaperBlockTemplate" ADD CONSTRAINT "EpaperBlockTemplate_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EpaperSettings
ALTER TABLE "EpaperSettings" ADD CONSTRAINT "EpaperSettings_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EpaperSettings" ADD CONSTRAINT "EpaperSettings_mainHeaderTemplateId_fkey" 
  FOREIGN KEY ("mainHeaderTemplateId") REFERENCES "EpaperBlockTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EpaperSettings" ADD CONSTRAINT "EpaperSettings_innerHeaderTemplateId_fkey" 
  FOREIGN KEY ("innerHeaderTemplateId") REFERENCES "EpaperBlockTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EpaperSettings" ADD CONSTRAINT "EpaperSettings_footerTemplateId_fkey" 
  FOREIGN KEY ("footerTemplateId") REFERENCES "EpaperBlockTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- EpaperEdition
ALTER TABLE "EpaperEdition" ADD CONSTRAINT "EpaperEdition_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EpaperPageLayout
ALTER TABLE "EpaperPageLayout" ADD CONSTRAINT "EpaperPageLayout_editionId_fkey" 
  FOREIGN KEY ("editionId") REFERENCES "EpaperEdition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EpaperPageLayout" ADD CONSTRAINT "EpaperPageLayout_articleId_fkey" 
  FOREIGN KEY ("articleId") REFERENCES "NewspaperArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EpaperPageLayout" ADD CONSTRAINT "EpaperPageLayout_blockTemplateId_fkey" 
  FOREIGN KEY ("blockTemplateId") REFERENCES "EpaperBlockTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- NewspaperArticle block template references
ALTER TABLE "NewspaperArticle" ADD CONSTRAINT "NewspaperArticle_suggestedBlockTemplateId_fkey" 
  FOREIGN KEY ("suggestedBlockTemplateId") REFERENCES "EpaperBlockTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NewspaperArticle" ADD CONSTRAINT "NewspaperArticle_assignedBlockTemplateId_fkey" 
  FOREIGN KEY ("assignedBlockTemplateId") REFERENCES "EpaperBlockTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
