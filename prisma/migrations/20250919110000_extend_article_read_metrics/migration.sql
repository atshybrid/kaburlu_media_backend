-- Extend ArticleRead with engagement metrics
ALTER TABLE "ArticleRead" 
  ADD COLUMN "totalTimeMs" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxScrollPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "completed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastEventAt" TIMESTAMP,
  ADD COLUMN "completedAt" TIMESTAMP,
  ADD COLUMN "sessionsCount" INTEGER NOT NULL DEFAULT 0;
