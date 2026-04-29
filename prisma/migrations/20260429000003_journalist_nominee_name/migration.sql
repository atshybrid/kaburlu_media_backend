-- Migration: Add nomineeName to JournalistProfile
ALTER TABLE "JournalistProfile" ADD COLUMN IF NOT EXISTS "nomineeName" TEXT;
