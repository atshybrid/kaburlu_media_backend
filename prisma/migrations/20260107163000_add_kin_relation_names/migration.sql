-- Deploy-safe migration for Postgres
-- Adds KinRelationName table for multi-language kin relation labels.

CREATE TABLE IF NOT EXISTS "KinRelationName" (
  "id" TEXT NOT NULL,
  "kinRelationId" TEXT NOT NULL,
  "languageCode" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "altNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KinRelationName_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KinRelationName_kinRelationId_fkey'
  ) THEN
    ALTER TABLE "KinRelationName"
      ADD CONSTRAINT "KinRelationName_kinRelationId_fkey"
      FOREIGN KEY ("kinRelationId") REFERENCES "KinRelation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "KinRelationName_kinRelationId_languageCode_key"
  ON "KinRelationName"("kinRelationId", "languageCode");

CREATE INDEX IF NOT EXISTS "KinRelationName_languageCode_idx"
  ON "KinRelationName"("languageCode");
