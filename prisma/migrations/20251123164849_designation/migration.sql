/*
  Warnings:

  - The values [NATIONAL] on the enum `ReporterLevel` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `assemblyId` on the `Reporter` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ReporterLevel_new" AS ENUM ('STATE', 'DISTRICT', 'ASSEMBLY', 'MANDAL', 'VILLAGE');
ALTER TABLE "public"."Reporter" ALTER COLUMN "level" TYPE "public"."ReporterLevel_new" USING ("level"::text::"public"."ReporterLevel_new");
ALTER TYPE "public"."ReporterLevel" RENAME TO "ReporterLevel_old";
ALTER TYPE "public"."ReporterLevel_new" RENAME TO "ReporterLevel";
DROP TYPE "public"."ReporterLevel_old";
COMMIT;

-- AlterTable
ALTER TABLE "public"."Reporter" DROP COLUMN "assemblyId",
ADD COLUMN     "assemblyMandalId" TEXT,
ADD COLUMN     "designationId" TEXT,
ADD COLUMN     "villageName" TEXT;

-- CreateTable
CREATE TABLE "public"."ReporterDesignation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "level" "public"."ReporterLevel" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReporterDesignation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReporterDesignation_tenantId_level_idx" ON "public"."ReporterDesignation"("tenantId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ReporterDesignation_tenantId_code_key" ON "public"."ReporterDesignation"("tenantId", "code");

-- CreateIndex
CREATE INDEX "Reporter_tenantId_level_idx" ON "public"."Reporter"("tenantId", "level");

-- CreateIndex
CREATE INDEX "Reporter_designationId_idx" ON "public"."Reporter"("designationId");

-- AddForeignKey
ALTER TABLE "public"."Reporter" ADD CONSTRAINT "Reporter_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "public"."ReporterDesignation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reporter" ADD CONSTRAINT "Reporter_assemblyMandalId_fkey" FOREIGN KEY ("assemblyMandalId") REFERENCES "public"."Mandal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReporterDesignation" ADD CONSTRAINT "ReporterDesignation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
