-- Epaper header style catalog + smart design per edition

CREATE TABLE IF NOT EXISTS "EpaperHeaderStyle" (
  "id" SERIAL PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameTe" TEXT,
  "supportsCenterLogo" BOOLEAN NOT NULL DEFAULT false,
  "supportsLeftImage" BOOLEAN NOT NULL DEFAULT false,
  "supportsRightImage" BOOLEAN NOT NULL DEFAULT false,
  "supportsPaperNameImage" BOOLEAN NOT NULL DEFAULT false,
  "supportsSubHeaderCenterImage" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "EpaperHeaderStyle_key_key" UNIQUE ("key"),
  CONSTRAINT "EpaperHeaderStyle_type_number_key" UNIQUE ("type", "number")
);

CREATE INDEX IF NOT EXISTS "EpaperHeaderStyle_type_idx" ON "EpaperHeaderStyle" ("type");

CREATE TABLE IF NOT EXISTS "EpaperSmartDesign" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "publicationEditionId" TEXT NOT NULL,
  "subEditionScopeKey" TEXT NOT NULL DEFAULT '',
  "subEditionId" TEXT,
  "paperType" TEXT NOT NULL DEFAULT 'TABLOID',
  "totalPages" INTEGER NOT NULL DEFAULT 8,
  "perPageCostMonthly" DOUBLE PRECISION,
  "paperSellCost" DOUBLE PRECISION,
  "headerStyleNumber" INTEGER NOT NULL DEFAULT 1,
  "subHeaderStyleNumber" INTEGER NOT NULL DEFAULT 1,
  "headerStyleKey" TEXT NOT NULL DEFAULT 'main_style1',
  "subHeaderStyleKey" TEXT NOT NULL DEFAULT 'sub_header_style1',
  "headerData" TEXT,
  "headerLogoUrl" TEXT,
  "subHeaderLogoUrl" TEXT,
  "paperNameImageUrl" TEXT,
  "headerLeftImageUrl" TEXT,
  "headerRightImageUrl" TEXT,
  "publishedAreaText" TEXT,
  "tagline" TEXT,
  "websiteUrl" TEXT,
  "runningCommentText" TEXT,
  "runningCommentAuthor" TEXT,
  "rightArticleTitle" TEXT,
  "rightArticlePoints" TEXT,
  "lastPageFooterText" TEXT,
  "volumeStartNumber" INTEGER NOT NULL DEFAULT 1,
  "volumeStartYear" INTEGER NOT NULL,
  "issueStartNumber" INTEGER NOT NULL DEFAULT 1,
  "issueStartDate" DATE NOT NULL,
  "issueCounterMode" TEXT NOT NULL DEFAULT 'SEQUENTIAL',
  "newsCloseTime" TEXT NOT NULL DEFAULT '23:00',
  "languageCode" TEXT NOT NULL DEFAULT 'te',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "EpaperSmartDesign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "EpaperSmartDesign_publicationEditionId_fkey" FOREIGN KEY ("publicationEditionId") REFERENCES "EpaperPublicationEdition"("id") ON DELETE CASCADE,
  CONSTRAINT "EpaperSmartDesign_subEditionId_fkey" FOREIGN KEY ("subEditionId") REFERENCES "EpaperPublicationSubEdition"("id") ON DELETE SET NULL,
  CONSTRAINT "EpaperSmartDesign_tenant_edition_scope_key" UNIQUE ("tenantId", "publicationEditionId", "subEditionScopeKey")
);

CREATE INDEX IF NOT EXISTS "EpaperSmartDesign_tenantId_idx" ON "EpaperSmartDesign" ("tenantId");
CREATE INDEX IF NOT EXISTS "EpaperSmartDesign_publicationEditionId_idx" ON "EpaperSmartDesign" ("publicationEditionId");
CREATE INDEX IF NOT EXISTS "EpaperSmartDesign_subEditionId_idx" ON "EpaperSmartDesign" ("subEditionId");
