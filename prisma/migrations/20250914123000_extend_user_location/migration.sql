-- AlterTable: add extended fields to UserLocation
ALTER TABLE "public"."UserLocation"
ADD COLUMN "accuracyMeters" DOUBLE PRECISION,
ADD COLUMN "provider" TEXT,
ADD COLUMN "timestampUtc" TIMESTAMP(3),
ADD COLUMN "placeId" TEXT,
ADD COLUMN "placeName" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "source" TEXT;
