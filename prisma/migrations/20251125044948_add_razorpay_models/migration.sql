/*
  Warnings:

  - A unique constraint covering the columns `[reporterId,type,year,month]` on the table `ReporterPayment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `month` to the `ReporterPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `ReporterPayment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `ReporterPayment` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."ReporterPayment_reporterId_year_key";

-- AlterTable
ALTER TABLE "public"."ReporterPayment" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "month" INTEGER NOT NULL,
ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT,
ADD COLUMN     "tenantId" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "public"."RazorpayConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "keyId" TEXT NOT NULL,
    "keySecret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RazorpayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayConfig_tenantId_key" ON "public"."RazorpayConfig"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ReporterPayment_reporterId_type_year_month_key" ON "public"."ReporterPayment"("reporterId", "type", "year", "month");

-- AddForeignKey
ALTER TABLE "public"."ReporterPayment" ADD CONSTRAINT "ReporterPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RazorpayConfig" ADD CONSTRAINT "RazorpayConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
