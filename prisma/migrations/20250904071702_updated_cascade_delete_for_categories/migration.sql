-- DropForeignKey
ALTER TABLE "public"."CategoryTranslation" DROP CONSTRAINT "CategoryTranslation_categoryId_fkey";

-- AddForeignKey
ALTER TABLE "public"."CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
