/*
  Warnings:

  - You are about to drop the column `languageId` on the `Device` table. All the data in the column will be lost.
  - You are about to drop the column `roleId` on the `Device` table. All the data in the column will be lost.
  - The primary key for the `UserLocation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `UserLocation` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."Periodicity" AS ENUM ('DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "public"."FamilyRelationType" AS ENUM ('PARENT', 'CHILD', 'SPOUSE', 'SIBLING');

-- DropForeignKey
ALTER TABLE "public"."Device" DROP CONSTRAINT "Device_languageId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Device" DROP CONSTRAINT "Device_roleId_fkey";

-- DropIndex
DROP INDEX "public"."UserLocation_userId_key";

-- AlterTable
ALTER TABLE "public"."Device" DROP COLUMN "languageId",
DROP COLUMN "roleId",
ALTER COLUMN "deviceModel" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Language" ALTER COLUMN "direction" DROP NOT NULL,
ALTER COLUMN "nativeName" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."UserLocation" DROP CONSTRAINT "UserLocation_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "UserLocation_pkey" PRIMARY KEY ("userId");

-- CreateTable
CREATE TABLE "public"."TenantEntity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prgiNumber" TEXT NOT NULL,
    "registrationTitle" TEXT,
    "periodicity" "public"."Periodicity" NOT NULL DEFAULT 'DAILY',
    "registrationDate" TIMESTAMP(3),
    "languageId" TEXT,
    "ownerName" TEXT,
    "publisherName" TEXT,
    "editorName" TEXT,
    "publicationCountryId" TEXT,
    "publicationStateId" TEXT,
    "publicationDistrictId" TEXT,
    "publicationMandalId" TEXT,
    "printingPressName" TEXT,
    "printingDistrictId" TEXT,
    "printingMandalId" TEXT,
    "printingCityName" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyRelation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relatedUserId" TEXT NOT NULL,
    "relationType" "public"."FamilyRelationType" NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Family" (
    "id" TEXT NOT NULL,
    "familyName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KinRelation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "gender" TEXT,
    "side" TEXT,
    "generationUp" INTEGER NOT NULL DEFAULT 0,
    "generationDown" INTEGER NOT NULL DEFAULT 0,
    "en" TEXT NOT NULL,
    "te" TEXT NOT NULL,
    "isCommon" BOOLEAN NOT NULL DEFAULT true,
    "notes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KinRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantEntity_tenantId_key" ON "public"."TenantEntity"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantEntity_prgiNumber_key" ON "public"."TenantEntity"("prgiNumber");

-- CreateIndex
CREATE INDEX "FamilyRelation_userId_idx" ON "public"."FamilyRelation"("userId");

-- CreateIndex
CREATE INDEX "FamilyRelation_relatedUserId_idx" ON "public"."FamilyRelation"("relatedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyRelation_userId_relatedUserId_relationType_key" ON "public"."FamilyRelation"("userId", "relatedUserId", "relationType");

-- CreateIndex
CREATE INDEX "FamilyMember_userId_idx" ON "public"."FamilyMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "public"."FamilyMember"("familyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "KinRelation_code_key" ON "public"."KinRelation"("code");

-- AddForeignKey
ALTER TABLE "public"."TenantEntity" ADD CONSTRAINT "TenantEntity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantEntity" ADD CONSTRAINT "TenantEntity_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "public"."Language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantEntity" ADD CONSTRAINT "TenantEntity_publicationCountryId_fkey" FOREIGN KEY ("publicationCountryId") REFERENCES "public"."Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantEntity" ADD CONSTRAINT "TenantEntity_publicationStateId_fkey" FOREIGN KEY ("publicationStateId") REFERENCES "public"."State"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantEntity" ADD CONSTRAINT "TenantEntity_publicationDistrictId_fkey" FOREIGN KEY ("publicationDistrictId") REFERENCES "public"."District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantEntity" ADD CONSTRAINT "TenantEntity_publicationMandalId_fkey" FOREIGN KEY ("publicationMandalId") REFERENCES "public"."Mandal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantEntity" ADD CONSTRAINT "TenantEntity_printingDistrictId_fkey" FOREIGN KEY ("printingDistrictId") REFERENCES "public"."District"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TenantEntity" ADD CONSTRAINT "TenantEntity_printingMandalId_fkey" FOREIGN KEY ("printingMandalId") REFERENCES "public"."Mandal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyRelation" ADD CONSTRAINT "FamilyRelation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyRelation" ADD CONSTRAINT "FamilyRelation_relatedUserId_fkey" FOREIGN KEY ("relatedUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "public"."Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
