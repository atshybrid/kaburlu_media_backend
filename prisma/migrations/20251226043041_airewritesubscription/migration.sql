-- CreateTable
CREATE TABLE "public"."AiUsageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "articleId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "purpose" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "promptChars" INTEGER,
    "responseChars" INTEGER,
    "rawUsage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageEvent_tenantId_createdAt_idx" ON "public"."AiUsageEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_articleId_idx" ON "public"."AiUsageEvent"("articleId");

-- AddForeignKey
ALTER TABLE "public"."AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
