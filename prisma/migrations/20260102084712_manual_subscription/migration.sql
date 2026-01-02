-- AlterTable
ALTER TABLE "public"."Reporter" ADD COLUMN     "manualLoginActivatedAt" TIMESTAMP(3),
ADD COLUMN     "manualLoginDays" INTEGER,
ADD COLUMN     "manualLoginEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualLoginExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Reporter_manualLoginEnabled_manualLoginExpiresAt_idx" ON "public"."Reporter"("manualLoginEnabled", "manualLoginExpiresAt");
