-- AlterTable: add extended fields to UserLocation (idempotent)
ALTER TABLE "public"."UserLocation"
ADD COLUMN IF NOT EXISTS "accuracyMeters" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "provider" TEXT,
ADD COLUMN IF NOT EXISTS "timestampUtc" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "placeId" TEXT,
ADD COLUMN IF NOT EXISTS "placeName" TEXT,
ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "source" TEXT;
