-- AlterTable
ALTER TABLE "public"."ShortNewsRead" ADD COLUMN     "deviceId" TEXT;

-- CreateTable
CREATE TABLE "public"."NewspaperArticle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "languageId" TEXT,
    "baseArticleId" TEXT,
    "title" TEXT NOT NULL,
    "subTitle" TEXT,
    "heading" TEXT NOT NULL,
    "points" TEXT[],
    "dateline" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "placeName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewspaperArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewspaperArticle_tenantId_idx" ON "public"."NewspaperArticle"("tenantId");

-- AddForeignKey
ALTER TABLE "public"."NewspaperArticle" ADD CONSTRAINT "NewspaperArticle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NewspaperArticle" ADD CONSTRAINT "NewspaperArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NewspaperArticle" ADD CONSTRAINT "NewspaperArticle_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NewspaperArticle" ADD CONSTRAINT "NewspaperArticle_baseArticleId_fkey" FOREIGN KEY ("baseArticleId") REFERENCES "public"."Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
