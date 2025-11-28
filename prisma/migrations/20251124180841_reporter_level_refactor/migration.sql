/*
  Warnings:

  - The values [VILLAGE] on the enum `ReporterLevel` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `assemblyMandalId` on the `Reporter` table. All the data in the column will be lost.
  - You are about to drop the column `idCardFee` on the `Reporter` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `Reporter` table. All the data in the column will be lost.
  - You are about to drop the column `villageName` on the `Reporter` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ReporterLevel_new" AS ENUM ('STATE', 'DISTRICT', 'ASSEMBLY', 'MANDAL');
ALTER TABLE "public"."Reporter" ALTER COLUMN "level" TYPE "public"."ReporterLevel_new" USING ("level"::text::"public"."ReporterLevel_new");
ALTER TABLE "public"."ReporterDesignation" ALTER COLUMN "level" TYPE "public"."ReporterLevel_new" USING ("level"::text::"public"."ReporterLevel_new");
ALTER TYPE "public"."ReporterLevel" RENAME TO "ReporterLevel_old";
ALTER TYPE "public"."ReporterLevel_new" RENAME TO "ReporterLevel";
DROP TYPE "public"."ReporterLevel_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Reporter" DROP CONSTRAINT "Reporter_assemblyMandalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Reporter" DROP CONSTRAINT "Reporter_parentId_fkey";

-- AlterTable
ALTER TABLE "public"."Reporter" DROP COLUMN "assemblyMandalId",
DROP COLUMN "idCardFee",
DROP COLUMN "parentId",
DROP COLUMN "villageName",
ADD COLUMN     "assemblyConstituencyId" TEXT,
ADD COLUMN     "idCardCharge" INTEGER;

-- CreateTable
CREATE TABLE "public"."AssemblyConstituency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssemblyConstituency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssemblyConstituency_districtId_idx" ON "public"."AssemblyConstituency"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyConstituency_districtId_name_key" ON "public"."AssemblyConstituency"("districtId", "name");

-- AddForeignKey
ALTER TABLE "public"."Reporter" ADD CONSTRAINT "Reporter_assemblyConstituencyId_fkey" FOREIGN KEY ("assemblyConstituencyId") REFERENCES "public"."AssemblyConstituency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssemblyConstituency" ADD CONSTRAINT "AssemblyConstituency_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "public"."District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
