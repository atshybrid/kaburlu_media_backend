-- Additive, backward-compatible schema changes for NewspaperArticle rich print metadata.
-- Safe for existing data: only adds nullable/defaulted columns.

ALTER TABLE "NewspaperArticle"
ADD COLUMN IF NOT EXISTS "mediaCaptions" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "NewspaperArticle"
ADD COLUMN IF NOT EXISTS "mediaMeta" JSONB;

ALTER TABLE "NewspaperArticle"
ADD COLUMN IF NOT EXISTS "contentParagraphs" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "NewspaperArticle"
ADD COLUMN IF NOT EXISTS "layoutSuggestion" JSONB;
