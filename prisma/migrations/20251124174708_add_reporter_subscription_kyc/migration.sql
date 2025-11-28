-- CreateEnum
CREATE TYPE "public"."KycStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."Reporter" ADD COLUMN     "idCardFee" INTEGER,
ADD COLUMN     "kycData" JSONB,
ADD COLUMN     "kycStatus" "public"."KycStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "monthlySubscriptionAmount" INTEGER,
ADD COLUMN     "subscriptionActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Reporter_kycStatus_idx" ON "public"."Reporter"("kycStatus");
