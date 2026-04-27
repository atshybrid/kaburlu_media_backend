-- Migration: Add founder signature + signatory fields to JournalistUnionSettings
-- These allow all press cards to use one authoritative founder/president signature
-- instead of requiring per-state entries.

ALTER TABLE "JournalistUnionSettings"
  ADD COLUMN IF NOT EXISTS "founderSignatureUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "signatoryName"        TEXT,
  ADD COLUMN IF NOT EXISTS "signatoryTitle"       TEXT;
