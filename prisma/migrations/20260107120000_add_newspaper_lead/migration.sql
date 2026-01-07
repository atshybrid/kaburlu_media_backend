-- Add lead field for NewspaperArticle
ALTER TABLE "public"."NewspaperArticle"
ADD COLUMN IF NOT EXISTS "lead" TEXT;
