-- Ensure Domain sampleData* columns exist (safe for any DB state)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Domain'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Domain' AND column_name = 'sampleDataStatus'
  ) THEN
    ALTER TABLE "Domain" ADD COLUMN "sampleDataStatus" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Domain' AND column_name = 'sampleDataMessage'
  ) THEN
    ALTER TABLE "Domain" ADD COLUMN "sampleDataMessage" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Domain' AND column_name = 'sampleDataGeneratedAt'
  ) THEN
    ALTER TABLE "Domain" ADD COLUMN "sampleDataGeneratedAt" TIMESTAMP(3);
  END IF;

  CREATE INDEX IF NOT EXISTS "Domain_sampleDataStatus_idx" ON "Domain"("sampleDataStatus");
END $$;
