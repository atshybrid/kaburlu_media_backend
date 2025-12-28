-- AlterTable
ALTER TABLE "public"."NewspaperArticle" ADD COLUMN     "districtId" TEXT,
ADD COLUMN     "mandalId" TEXT,
ADD COLUMN     "stateId" TEXT,
ADD COLUMN     "villageId" TEXT;

-- CreateIndex
CREATE INDEX "NewspaperArticle_stateId_idx" ON "public"."NewspaperArticle"("stateId");

-- CreateIndex
CREATE INDEX "NewspaperArticle_districtId_idx" ON "public"."NewspaperArticle"("districtId");

-- CreateIndex
CREATE INDEX "NewspaperArticle_mandalId_idx" ON "public"."NewspaperArticle"("mandalId");

-- CreateIndex
CREATE INDEX "NewspaperArticle_villageId_idx" ON "public"."NewspaperArticle"("villageId");
