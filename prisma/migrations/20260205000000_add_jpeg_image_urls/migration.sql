-- Add JPEG image URL fields for social sharing / OG tags
-- PNG remains master; WebP remains optimized delivery; JPEG improves compatibility with some platforms.

-- Add JPEG cover image URL to EpaperPdfIssue
ALTER TABLE "EpaperPdfIssue" ADD COLUMN "coverImageUrlJpeg" TEXT;

-- Add JPEG image URL to EpaperPdfPage
ALTER TABLE "EpaperPdfPage" ADD COLUMN "imageUrlJpeg" TEXT;

COMMENT ON COLUMN "EpaperPdfIssue"."coverImageUrlJpeg" IS 'JPEG version of cover image for social sharing/OG tags (platform compatibility)';
COMMENT ON COLUMN "EpaperPdfPage"."imageUrlJpeg" IS 'JPEG version for social sharing/OG tags (platform compatibility)';
