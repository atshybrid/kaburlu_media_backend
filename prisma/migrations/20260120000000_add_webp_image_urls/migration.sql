-- Add WebP image URL fields for optimized frontend delivery
-- PNG remains the master/archive format; WebP is for fast delivery (~60-80% smaller)

-- Add WebP cover image URL to EpaperPdfIssue
ALTER TABLE "EpaperPdfIssue" ADD COLUMN "coverImageUrlWebp" TEXT;

-- Add WebP image URL to EpaperPdfPage
ALTER TABLE "EpaperPdfPage" ADD COLUMN "imageUrlWebp" TEXT;

-- Add comment for documentation
COMMENT ON COLUMN "EpaperPdfIssue"."coverImageUrlWebp" IS 'WebP version of cover image for optimized delivery (frontend prefers this)';
COMMENT ON COLUMN "EpaperPdfPage"."imageUrlWebp" IS 'WebP optimized image URL for frontend delivery (~80% smaller than PNG)';
