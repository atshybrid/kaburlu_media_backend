-- Remove FK constraint from Comment.articleId -> Article.id
-- After this, articleId is a plain string that can hold TenantWebArticle IDs (public website)
-- This is a non-destructive change: no data is removed, the column remains as-is.

ALTER TABLE "Comment" DROP CONSTRAINT IF EXISTS "Comment_articleId_fkey";
