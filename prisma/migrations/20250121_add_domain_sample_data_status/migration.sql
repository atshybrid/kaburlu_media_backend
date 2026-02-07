-- Add sampleDataStatus field to Domain table for tracking bootstrap content generation status
-- This migration is idempotent

DO $$
BEGIN
  -- If Domain table doesn't exist yet (fresh/shadow DB), skip safely.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Domain'
  ) THEN
    RETURN;
  END IF;

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
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Domain'
  ) THEN
    CREATE INDEX IF NOT EXISTS "Domain_sampleDataStatus_idx" ON "Domain"("sampleDataStatus");
  END IF;
END $$;
