-- Safe cleanup of ReporterDesignation table
-- Step 1: Set all Reporter.designationId to NULL (preserve reporter data)
UPDATE "Reporter" SET "designationId" = NULL WHERE "designationId" IS NOT NULL;

-- Step 2: Set all ReporterOnboardingOrder.designationId to NULL (if exists)
UPDATE "ReporterOnboardingOrder" SET "designationId" = NULL WHERE "designationId" IS NOT NULL;

-- Step 3: Now safely delete all ReporterDesignation records
DELETE FROM "ReporterDesignation";

-- Verification
SELECT 'Reporters count' as table_name, COUNT(*) as count FROM "Reporter"
UNION ALL
SELECT 'ReporterDesignation count', COUNT(*) FROM "ReporterDesignation";
