-- Browser Web Push subscriptions (tenant/domain scoped)
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebPushSubscription_domainId_endpoint_key"
  ON "WebPushSubscription"("domainId", "endpoint");

CREATE INDEX "WebPushSubscription_tenantId_domainId_isActive_idx"
  ON "WebPushSubscription"("tenantId", "domainId", "isActive");

CREATE INDEX "WebPushSubscription_domainId_isActive_idx"
  ON "WebPushSubscription"("domainId", "isActive");

ALTER TABLE "WebPushSubscription"
  ADD CONSTRAINT "WebPushSubscription_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebPushSubscription"
  ADD CONSTRAINT "WebPushSubscription_domainId_fkey"
  FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
