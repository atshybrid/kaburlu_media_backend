-- CreateTable
CREATE TABLE "EpaperNewsBlock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "newspaperArticleId" TEXT,
    "blockTemplateId" TEXT NOT NULL,
    "blockCode" TEXT NOT NULL,
    "publicationEditionId" TEXT,
    "issueDate" DATE,
    "pageNumber" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content" TEXT NOT NULL,
    "dateline" TEXT,
    "wordCount" INTEGER,
    "charCount" INTEGER,
    "widthMm" DOUBLE PRECISION NOT NULL,
    "maxHeightMm" DOUBLE PRECISION NOT NULL,
    "estimatedHeightMm" DOUBLE PRECISION,
    "html" TEXT NOT NULL,
    "css" TEXT NOT NULL,
    "isOverflow" BOOLEAN NOT NULL DEFAULT false,
    "isRejected" BOOLEAN NOT NULL DEFAULT false,
    "rejectReason" TEXT,
    "renderMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperNewsBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EpaperNewsBlock_tenantId_idx" ON "EpaperNewsBlock"("tenantId");
CREATE INDEX "EpaperNewsBlock_newspaperArticleId_idx" ON "EpaperNewsBlock"("newspaperArticleId");
CREATE INDEX "EpaperNewsBlock_blockTemplateId_idx" ON "EpaperNewsBlock"("blockTemplateId");
CREATE INDEX "EpaperNewsBlock_blockCode_idx" ON "EpaperNewsBlock"("blockCode");
CREATE INDEX "EpaperNewsBlock_issueDate_idx" ON "EpaperNewsBlock"("issueDate");
CREATE INDEX "EpaperNewsBlock_publicationEditionId_idx" ON "EpaperNewsBlock"("publicationEditionId");

-- AddForeignKey
ALTER TABLE "EpaperNewsBlock" ADD CONSTRAINT "EpaperNewsBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EpaperNewsBlock" ADD CONSTRAINT "EpaperNewsBlock_newspaperArticleId_fkey" FOREIGN KEY ("newspaperArticleId") REFERENCES "NewspaperArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EpaperNewsBlock" ADD CONSTRAINT "EpaperNewsBlock_blockTemplateId_fkey" FOREIGN KEY ("blockTemplateId") REFERENCES "EpaperBlockTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
