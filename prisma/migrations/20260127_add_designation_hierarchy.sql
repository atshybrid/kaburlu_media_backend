-- Add levelOrder and nativeName fields to ReporterDesignation
-- Step 1: Add fields with temporary defaults
ALTER TABLE "ReporterDesignation" 
ADD COLUMN "levelOrder" INTEGER DEFAULT 999,
ADD COLUMN "nativeName" TEXT;

-- Step 2: Set proper levelOrder based on level
UPDATE "ReporterDesignation"
SET "levelOrder" = CASE 
  WHEN "level" = 'STATE' THEN 1
  WHEN "level" = 'DISTRICT' THEN 2
  WHEN "level" = 'ASSEMBLY' THEN 3
  WHEN "level" = 'MANDAL' THEN 4
  ELSE 999
END;

-- Step 3: Remove default (make it required going forward)
ALTER TABLE "ReporterDesignation" 
ALTER COLUMN "levelOrder" DROP DEFAULT;

-- Step 4: Add index for performance
CREATE INDEX "ReporterDesignation_tenantId_levelOrder_idx" ON "ReporterDesignation"("tenantId", "levelOrder");
