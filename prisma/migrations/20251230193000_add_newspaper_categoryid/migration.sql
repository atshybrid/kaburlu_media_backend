-- AlterTable
ALTER TABLE "public"."NewspaperArticle" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "NewspaperArticle_categoryId_idx" ON "public"."NewspaperArticle"("categoryId");

-- AddForeignKey
ALTER TABLE "public"."NewspaperArticle" ADD CONSTRAINT "NewspaperArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
