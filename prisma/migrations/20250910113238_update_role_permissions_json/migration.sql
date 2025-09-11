/*
  Warnings:

  - You are about to drop the column `publishedAt` on the `Article` table. All the data in the column will be lost.
  - The `status` column on the `Article` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `iconUrl` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `order` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `languageId` on the `CategoryTranslation` table. All the data in the column will be lost.
  - You are about to drop the column `isRtl` on the `Language` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `State` table. All the data in the column will be lost.
  - You are about to drop the column `countryId` on the `State` table. All the data in the column will be lost.
  - You are about to drop the column `languageId` on the `State` table. All the data in the column will be lost.
  - You are about to drop the column `isVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - The `status` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `ArticleCategory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ArticleHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Country` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Location` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OtpLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserProfile` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[categoryId,language]` on the table `CategoryTranslation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[deviceId]` on the table `Device` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Language` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `State` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `UserLocation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `language` to the `CategoryTranslation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nativeName` to the `Language` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `name` on the `Role` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `country` to the `State` table without a default value. This is not possible if the table is not empty.
  - Made the column `languageId` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `UserLocation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."ArticleCategory" DROP CONSTRAINT "ArticleCategory_articleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ArticleCategory" DROP CONSTRAINT "ArticleCategory_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ArticleHistory" DROP CONSTRAINT "ArticleHistory_articleId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ArticleHistory" DROP CONSTRAINT "ArticleHistory_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CategoryTranslation" DROP CONSTRAINT "CategoryTranslation_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."CategoryTranslation" DROP CONSTRAINT "CategoryTranslation_languageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Device" DROP CONSTRAINT "Device_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Location" DROP CONSTRAINT "Location_parentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Location" DROP CONSTRAINT "Location_stateId_fkey";

-- DropForeignKey
ALTER TABLE "public"."State" DROP CONSTRAINT "State_countryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."State" DROP CONSTRAINT "State_languageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_languageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserLocation" DROP CONSTRAINT "UserLocation_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserProfile" DROP CONSTRAINT "UserProfile_assemblyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserProfile" DROP CONSTRAINT "UserProfile_districtId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserProfile" DROP CONSTRAINT "UserProfile_mandalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserProfile" DROP CONSTRAINT "UserProfile_stateId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserProfile" DROP CONSTRAINT "UserProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserProfile" DROP CONSTRAINT "UserProfile_villageId_fkey";

-- DropIndex
DROP INDEX "public"."Category_name_key";

-- DropIndex
DROP INDEX "public"."CategoryTranslation_categoryId_languageId_key";

-- DropIndex
DROP INDEX "public"."Device_userId_deviceId_key";

-- DropIndex
DROP INDEX "public"."State_code_key";

-- AlterTable
ALTER TABLE "public"."Article" DROP COLUMN "publishedAt",
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "isBreakingNews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTrending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[],
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "public"."Category" DROP COLUMN "iconUrl",
DROP COLUMN "isActive",
DROP COLUMN "order",
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."CategoryTranslation" DROP COLUMN "languageId",
ADD COLUMN     "language" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Language" DROP COLUMN "isRtl",
ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'ltr',
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nativeName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Role" DROP COLUMN "name",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."State" DROP COLUMN "code",
DROP COLUMN "countryId",
DROP COLUMN "languageId",
ADD COLUMN     "country" TEXT NOT NULL,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "isVerified",
DROP COLUMN "name",
ALTER COLUMN "languageId" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "public"."UserLocation" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "public"."ArticleCategory";

-- DropTable
DROP TABLE "public"."ArticleHistory";

-- DropTable
DROP TABLE "public"."Country";

-- DropTable
DROP TABLE "public"."Location";

-- DropTable
DROP TABLE "public"."OtpLog";

-- DropTable
DROP TABLE "public"."UserProfile";

-- DropEnum
DROP TYPE "public"."ArticleStatus";

-- DropEnum
DROP TYPE "public"."HistoryAction";

-- DropEnum
DROP TYPE "public"."LocationType";

-- DropEnum
DROP TYPE "public"."RoleName";

-- DropEnum
DROP TYPE "public"."UserStatus";

-- CreateTable
CREATE TABLE "public"."District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Mandal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mandal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_ArticleToCategory" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleToCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_RelatedArticles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RelatedArticles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ArticleToCategory_B_index" ON "public"."_ArticleToCategory"("B");

-- CreateIndex
CREATE INDEX "_RelatedArticles_B_index" ON "public"."_RelatedArticles"("B");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTranslation_categoryId_language_key" ON "public"."CategoryTranslation"("categoryId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "public"."Device"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Language_name_key" ON "public"."Language"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "State_name_key" ON "public"."State"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserLocation_userId_key" ON "public"."UserLocation"("userId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserLocation" ADD CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."District" ADD CONSTRAINT "District_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mandal" ADD CONSTRAINT "Mandal_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "public"."District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ArticleToCategory" ADD CONSTRAINT "_ArticleToCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ArticleToCategory" ADD CONSTRAINT "_ArticleToCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_RelatedArticles" ADD CONSTRAINT "_RelatedArticles_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_RelatedArticles" ADD CONSTRAINT "_RelatedArticles_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
