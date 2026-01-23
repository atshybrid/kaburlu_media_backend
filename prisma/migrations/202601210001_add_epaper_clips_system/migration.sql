-- ePaper Article Clips System Migration
-- This migration adds support for PDF-only mode with article clip coordinates.
-- Key tables: EpaperArticleClip, EpaperClipAsset, PublicCropSession

-- Add pdfOnlyMode flag to existing issues
ALTER TABLE "public"."EpaperPdfIssue" ADD COLUMN IF NOT EXISTS "pdfOnlyMode" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- EpaperArticleClip: Core table for article clip coordinates
-- Stores PDF coordinates (in points, 1/72 inch)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."EpaperArticleClip" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "column" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL DEFAULT 'editor',
    "updatedBy" TEXT NOT NULL DEFAULT 'editor',
    "title" TEXT,
    "articleRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpaperArticleClip_pkey" PRIMARY KEY ("id")
);

-- Indexes for EpaperArticleClip
CREATE INDEX IF NOT EXISTS "EpaperArticleClip_issueId_idx" ON "public"."EpaperArticleClip"("issueId");
CREATE INDEX IF NOT EXISTS "EpaperArticleClip_issueId_pageNumber_idx" ON "public"."EpaperArticleClip"("issueId", "pageNumber");
CREATE INDEX IF NOT EXISTS "EpaperArticleClip_isActive_idx" ON "public"."EpaperArticleClip"("isActive");

-- Foreign key (only add if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'EpaperArticleClip_issueId_fkey'
    ) THEN
        ALTER TABLE "public"."EpaperArticleClip" 
        ADD CONSTRAINT "EpaperArticleClip_issueId_fkey" 
        FOREIGN KEY ("issueId") REFERENCES "public"."EpaperPdfIssue"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- EpaperClipAsset: Cached clip images (generated on-demand)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."EpaperClipAsset" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpaperClipAsset_pkey" PRIMARY KEY ("id")
);

-- Indexes for EpaperClipAsset
CREATE INDEX IF NOT EXISTS "EpaperClipAsset_clipId_idx" ON "public"."EpaperClipAsset"("clipId");
CREATE UNIQUE INDEX IF NOT EXISTS "EpaperClipAsset_clipId_type_key" ON "public"."EpaperClipAsset"("clipId", "type");

-- Foreign key (only add if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'EpaperClipAsset_clipId_fkey'
    ) THEN
        ALTER TABLE "public"."EpaperClipAsset" 
        ADD CONSTRAINT "EpaperClipAsset_clipId_fkey" 
        FOREIGN KEY ("clipId") REFERENCES "public"."EpaperArticleClip"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- PublicCropSession: Temporary secure sessions for public clip updates
-- TTL = 5 minutes, one-time use
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."PublicCropSession" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "clipId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicCropSession_pkey" PRIMARY KEY ("id")
);

-- Indexes for PublicCropSession
CREATE UNIQUE INDEX IF NOT EXISTS "PublicCropSession_sessionKey_key" ON "public"."PublicCropSession"("sessionKey");
CREATE INDEX IF NOT EXISTS "PublicCropSession_sessionKey_idx" ON "public"."PublicCropSession"("sessionKey");
CREATE INDEX IF NOT EXISTS "PublicCropSession_issueId_idx" ON "public"."PublicCropSession"("issueId");
CREATE INDEX IF NOT EXISTS "PublicCropSession_expiresAt_idx" ON "public"."PublicCropSession"("expiresAt");

-- Foreign keys (only add if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PublicCropSession_issueId_fkey'
    ) THEN
        ALTER TABLE "public"."PublicCropSession" 
        ADD CONSTRAINT "PublicCropSession_issueId_fkey" 
        FOREIGN KEY ("issueId") REFERENCES "public"."EpaperPdfIssue"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PublicCropSession_clipId_fkey'
    ) THEN
        ALTER TABLE "public"."PublicCropSession" 
        ADD CONSTRAINT "PublicCropSession_clipId_fkey" 
        FOREIGN KEY ("clipId") REFERENCES "public"."EpaperArticleClip"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- CLEANUP: Create a scheduled job to delete expired sessions
-- Run this periodically: DELETE FROM "PublicCropSession" WHERE "expiresAt" < NOW();
-- ============================================================================
