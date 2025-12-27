-- AlterTable
ALTER TABLE "public"."TenantFeatureFlags" ADD COLUMN     "aiBillingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiMonthlyTokenLimit" INTEGER;
