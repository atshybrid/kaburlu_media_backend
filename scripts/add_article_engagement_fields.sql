-- ============================================================================
-- Add Article Engagement & Navigation Fields to TenantWebArticle
-- ============================================================================
-- Run this script directly in Neon SQL Editor before running Prisma migrate
-- This adds columns for: isLive, shareCount, previousArticleId, nextArticleId
-- ============================================================================

-- 1. Add isLive field (for live updates badge)
ALTER TABLE "TenantWebArticle" 
ADD COLUMN IF NOT EXISTS "isLive" BOOLEAN NOT NULL DEFAULT false;

-- 2. Add shareCount field (for social share metrics)
ALTER TABLE "TenantWebArticle" 
ADD COLUMN IF NOT EXISTS "shareCount" INTEGER NOT NULL DEFAULT 0;

-- 3. Add previousArticleId (for article navigation)
ALTER TABLE "TenantWebArticle" 
ADD COLUMN IF NOT EXISTS "previousArticleId" TEXT;

-- 4. Add nextArticleId (for article navigation)
ALTER TABLE "TenantWebArticle" 
ADD COLUMN IF NOT EXISTS "nextArticleId" TEXT;

-- 5. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "TenantWebArticle_isBreaking_idx" 
ON "TenantWebArticle" ("tenantId", "isBreaking") 
WHERE "isBreaking" = true;

CREATE INDEX IF NOT EXISTS "TenantWebArticle_isLive_idx" 
ON "TenantWebArticle" ("tenantId", "isLive") 
WHERE "isLive" = true;

CREATE INDEX IF NOT EXISTS "TenantWebArticle_shareCount_idx" 
ON "TenantWebArticle" ("tenantId", "shareCount");

-- 6. Add check constraint to ensure shareCount is non-negative
ALTER TABLE "TenantWebArticle" 
ADD CONSTRAINT "TenantWebArticle_shareCount_check" 
CHECK ("shareCount" >= 0);

-- ============================================================================
-- Verify the changes
-- ============================================================================
-- Run this to check all columns were added successfully:
/*
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'TenantWebArticle'
  AND column_name IN ('isLive', 'shareCount', 'previousArticleId', 'nextArticleId')
ORDER BY ordinal_position;
*/

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================
-- To remove these columns (in case of issues):
/*
ALTER TABLE "TenantWebArticle" DROP COLUMN IF EXISTS "isLive";
ALTER TABLE "TenantWebArticle" DROP COLUMN IF EXISTS "shareCount";
ALTER TABLE "TenantWebArticle" DROP COLUMN IF EXISTS "previousArticleId";
ALTER TABLE "TenantWebArticle" DROP COLUMN IF EXISTS "nextArticleId";
ALTER TABLE "TenantWebArticle" DROP CONSTRAINT IF EXISTS "TenantWebArticle_shareCount_check";
DROP INDEX IF EXISTS "TenantWebArticle_isBreaking_idx";
DROP INDEX IF EXISTS "TenantWebArticle_isLive_idx";
DROP INDEX IF EXISTS "TenantWebArticle_shareCount_idx";
*/
