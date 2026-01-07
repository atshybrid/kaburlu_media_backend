-- Add breaking + AI validation metadata (deploy-safe forward-only migration)

ALTER TABLE "ShortNews" ADD COLUMN IF NOT EXISTS "isBreaking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShortNews" ADD COLUMN IF NOT EXISTS "aiApprovalStatus" TEXT;
ALTER TABLE "ShortNews" ADD COLUMN IF NOT EXISTS "aiViolationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ShortNews" ADD COLUMN IF NOT EXISTS "aiValidationIssues" JSONB;

ALTER TABLE "TenantWebArticle" ADD COLUMN IF NOT EXISTS "isBreaking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantWebArticle" ADD COLUMN IF NOT EXISTS "aiApprovalStatus" TEXT;
ALTER TABLE "TenantWebArticle" ADD COLUMN IF NOT EXISTS "aiViolationCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TenantWebArticle" ADD COLUMN IF NOT EXISTS "aiValidationIssues" JSONB;
