-- CreateTable
CREATE TABLE "public"."WhatsappBotSession" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "unionName" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappBotSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappBotSession_phone_key" ON "public"."WhatsappBotSession"("phone");

-- CreateIndex
CREATE INDEX "WhatsappBotSession_phone_idx" ON "public"."WhatsappBotSession"("phone");

-- CreateIndex
CREATE INDEX "WhatsappBotSession_expiresAt_idx" ON "public"."WhatsappBotSession"("expiresAt");

