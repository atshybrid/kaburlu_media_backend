-- Script to resolve failed migration 202601210001_add_epaper_clips_system
-- Run this directly on production DB to mark the migration as resolved

-- STEP 1: Mark the failed migration as rolled back
UPDATE "_prisma_migrations" 
SET finished_at = NULL, 
    applied_steps_count = 0, 
    logs = NULL
WHERE migration_name = '202601210001_add_epaper_clips_system';

-- STEP 2: Delete the migration record entirely (Prisma will re-apply it)
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '202601210001_add_epaper_clips_system';

-- After running this script:
-- 1. Commit and push the updated migration.sql file
-- 2. Redeploy on Render
-- 3. The migration will now be idempotent and won't fail on existing constraints
