/*
  Warnings:

  - You are about to drop the column `aiMeta` on the `ShortNews` table. All the data in the column will be lost.
  - Made the column `categoryId` on table `ShortNews` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."ShortNews" DROP COLUMN "aiMeta",
ADD COLUMN     "allowComments" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "featuredImage" TEXT,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "publishDate" TIMESTAMP(3),
ADD COLUMN     "seo" JSONB,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "tags" TEXT[],
ALTER COLUMN "categoryId" SET NOT NULL;
