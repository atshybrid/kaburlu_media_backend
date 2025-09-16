-- Make userId nullable and change FK to ON DELETE SET NULL
ALTER TABLE "Device" DROP CONSTRAINT IF EXISTS "Device_userId_fkey";
ALTER TABLE "Device" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "Device"
  ADD CONSTRAINT "Device_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Add new optional columns for device location/place metadata
ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "accuracyMeters" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "placeId" TEXT,
  ADD COLUMN IF NOT EXISTS "placeName" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT;