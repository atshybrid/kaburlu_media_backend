-- Add new reporter levels DIVISION and CONSTITUENCY
ALTER TYPE "ReporterLevel" ADD VALUE IF NOT EXISTS 'DIVISION';
ALTER TYPE "ReporterLevel" ADD VALUE IF NOT EXISTS 'CONSTITUENCY';

-- Add new fields to Reporter table for DIVISION and CONSTITUENCY levels
ALTER TABLE "Reporter" ADD COLUMN IF NOT EXISTS "divisionId" TEXT;
ALTER TABLE "Reporter" ADD COLUMN IF NOT EXISTS "constituencyId" TEXT;

-- Add comments for new fields
COMMENT ON COLUMN "Reporter"."divisionId" IS 'For DIVISION level - can be districtId or mandalId';
COMMENT ON COLUMN "Reporter"."constituencyId" IS 'For CONSTITUENCY level - can be districtId, mandalId, or assemblyConstituencyId';
