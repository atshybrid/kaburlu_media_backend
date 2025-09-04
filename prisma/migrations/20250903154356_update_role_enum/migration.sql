/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `iconUrl` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `key` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `CategoryTranslation` table. All the data in the column will be lost.
  - You are about to drop the column `displayName` on the `CategoryTranslation` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `Language` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `OtpLog` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `State` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Category` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Language` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `State` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `State` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `Category` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `CategoryTranslation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `OtpLog` table without a default value. This is not possible if the table is not empty.
  - Made the column `languageId` on table `State` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."LocationType" AS ENUM ('district', 'assembly', 'mandal', 'village');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."RoleName" ADD VALUE 'ADMIN';
ALTER TYPE "public"."RoleName" ADD VALUE 'REPORTER';

-- DropForeignKey
ALTER TABLE "public"."CategoryTranslation" DROP CONSTRAINT "CategoryTranslation_languageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."State" DROP CONSTRAINT "State_languageId_fkey";

-- DropIndex
DROP INDEX "public"."Category_key_key";

-- DropIndex
DROP INDEX "public"."CategoryTranslation_categoryId_languageId_key";

-- AlterTable
ALTER TABLE "public"."Category" DROP COLUMN "deletedAt",
DROP COLUMN "iconUrl",
DROP COLUMN "key",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "order" INTEGER NOT NULL,
ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."CategoryTranslation" DROP COLUMN "deletedAt",
DROP COLUMN "displayName",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."Language" DROP COLUMN "deletedAt";

-- AlterTable
ALTER TABLE "public"."OtpLog" DROP COLUMN "expiresAt",
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "public"."Role" DROP COLUMN "deletedAt";

-- AlterTable
ALTER TABLE "public"."State" DROP COLUMN "deletedAt",
ADD COLUMN     "code" TEXT,
ADD COLUMN     "countryId" TEXT,
ALTER COLUMN "languageId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "gender" "public"."Gender",
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "maritalStatus" "public"."MaritalStatus",
ADD COLUMN     "status" TEXT DEFAULT 'active',
ALTER COLUMN "isVerified" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."LocationType" NOT NULL,
    "level" INTEGER NOT NULL,
    "stateId" TEXT NOT NULL,
    "parentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Country_name_key" ON "public"."Country"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "public"."Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "public"."Location"("code");

-- CreateIndex
CREATE INDEX "Location_stateId_type_idx" ON "public"."Location"("stateId", "type");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "public"."Location"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "public"."Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Language_name_key" ON "public"."Language"("name");

-- CreateIndex
CREATE UNIQUE INDEX "State_name_key" ON "public"."State"("name");

-- CreateIndex
CREATE UNIQUE INDEX "State_code_key" ON "public"."State"("code");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."State" ADD CONSTRAINT "State_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "public"."Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."State" ADD CONSTRAINT "State_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Location" ADD CONSTRAINT "Location_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
