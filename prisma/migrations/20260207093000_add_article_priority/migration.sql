-- Add Article.priority column (schema expects it, some DBs are missing it)

ALTER TABLE "Article"
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 3;

-- Index used by @@index([priority]) in schema.prisma
CREATE INDEX IF NOT EXISTS "Article_priority_idx" ON "Article"("priority");
