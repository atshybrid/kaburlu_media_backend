-- Manual patch for ArticleRead metrics columns (run once if migration drift prevents prisma migrate dev)
ALTER TABLE "public"."ArticleRead" 
  ADD COLUMN IF NOT EXISTS "totalTimeMs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxScrollPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "completed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastEventAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "sessionsCount" INTEGER NOT NULL DEFAULT 0;

-- After running this manually in DB, mark migration applied:
-- npx prisma migrate resolve --applied 20250919110000_extend_article_read_metrics
