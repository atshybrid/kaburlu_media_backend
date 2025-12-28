-- Add homepageConfig JSONB column to TenantTheme (backward-compatible)
ALTER TABLE "TenantTheme" ADD COLUMN IF NOT EXISTS "homepageConfig" JSONB;
