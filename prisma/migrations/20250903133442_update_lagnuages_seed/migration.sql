/*
  Warnings:

  - You are about to drop the column `name` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_PermissionToRole` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[key]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `iconUrl` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `permissions` to the `Role` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `name` on the `Role` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."RoleName" AS ENUM ('SUPER_ADMIN', 'LANGUAGE_ADMIN', 'NEWS_DESK', 'CITIZEN_REPORTER', 'GUEST');

-- DropForeignKey
ALTER TABLE "public"."_PermissionToRole" DROP CONSTRAINT "_PermissionToRole_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_PermissionToRole" DROP CONSTRAINT "_PermissionToRole_B_fkey";

-- AlterTable
ALTER TABLE "public"."Category" DROP COLUMN "name",
ADD COLUMN     "iconUrl" TEXT NOT NULL,
ADD COLUMN     "key" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Language" ADD COLUMN     "isRtl" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Role" ADD COLUMN     "permissions" JSONB NOT NULL,
DROP COLUMN "name",
ADD COLUMN     "name" "public"."RoleName" NOT NULL;

-- AlterTable
ALTER TABLE "public"."State" ADD COLUMN     "languageId" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "public"."Permission";

-- DropTable
DROP TABLE "public"."_PermissionToRole";

-- CreateTable
CREATE TABLE "public"."CategoryTranslation" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTranslation_categoryId_languageId_key" ON "public"."CategoryTranslation"("categoryId", "languageId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_key_key" ON "public"."Category"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- AddForeignKey
ALTER TABLE "public"."State" ADD CONSTRAINT "State_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
