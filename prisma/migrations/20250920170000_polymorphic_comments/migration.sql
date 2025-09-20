-- Polymorphic comments migration
-- Make articleId nullable and add shortNewsId
ALTER TABLE "Comment" ALTER COLUMN "articleId" DROP NOT NULL;
ALTER TABLE "Comment" ADD COLUMN "shortNewsId" TEXT;

-- Add foreign key to ShortNews (cascade delete to remove comments when shortnews deleted)
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_shortNews_fkey" FOREIGN KEY ("shortNewsId") REFERENCES "ShortNews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add supporting indexes
CREATE INDEX IF NOT EXISTS "Comment_articleId_idx" ON "Comment"("articleId");
CREATE INDEX IF NOT EXISTS "Comment_shortNewsId_idx" ON "Comment"("shortNewsId");
CREATE INDEX IF NOT EXISTS "Comment_parentId_idx" ON "Comment"("parentId");

-- Enforce exactly one of articleId or shortNewsId present (Postgres CHECK)
ALTER TABLE "Comment" ADD CONSTRAINT comment_one_content_target CHECK (
  (CASE WHEN "articleId" IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN "shortNewsId" IS NOT NULL THEN 1 ELSE 0 END) = 1
);
