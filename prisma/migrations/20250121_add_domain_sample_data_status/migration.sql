-- Add sampleDataStatus field to Domain table for tracking bootstrap content generation status
-- This migration is idempotent

DO $$
BEGIN
  -- Add sampleDataStatus column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Domain' AND column_name = 'sampleDataStatus'
  ) THEN
    ALTER TABLE "Domain" ADD COLUMN "sampleDataStatus" TEXT;
  END IF;

  -- Add sampleDataMessage column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Domain' AND column_name = 'sampleDataMessage'
  ) THEN
    ALTER TABLE "Domain" ADD COLUMN "sampleDataMessage" TEXT;
  END IF;

  -- Add sampleDataGeneratedAt column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Domain' AND column_name = 'sampleDataGeneratedAt'
  ) THEN
    ALTER TABLE "Domain" ADD COLUMN "sampleDataGeneratedAt" TIMESTAMP(3);
  END IF;
END $$;

-- Create index on sampleDataStatus for efficient filtering
CREATE INDEX IF NOT EXISTS "Domain_sampleDataStatus_idx" ON "Domain"("sampleDataStatus");
