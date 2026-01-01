-- Add ReporterOnboardingOrder for payment-first public join

CREATE TABLE "ReporterOnboardingOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "mobileNumber" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "languageId" TEXT,
  "designationId" TEXT NOT NULL,
  "level" "ReporterLevel" NOT NULL,
  "stateId" TEXT,
  "districtId" TEXT,
  "mandalId" TEXT,
  "assemblyConstituencyId" TEXT,
  "subscriptionEnabled" BOOLEAN NOT NULL DEFAULT true,
  "monthlySubscriptionAmount" INTEGER,
  "idCardCharge" INTEGER,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "razorpayOrderId" TEXT NOT NULL,
  "razorpayPaymentId" TEXT,
  "meta" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReporterOnboardingOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReporterOnboardingOrder_razorpayOrderId_key" ON "ReporterOnboardingOrder"("razorpayOrderId");
CREATE INDEX "ReporterOnboardingOrder_tenantId_mobileNumber_idx" ON "ReporterOnboardingOrder"("tenantId", "mobileNumber");
CREATE INDEX "ReporterOnboardingOrder_status_idx" ON "ReporterOnboardingOrder"("status");

ALTER TABLE "ReporterOnboardingOrder"
ADD CONSTRAINT "ReporterOnboardingOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReporterOnboardingOrder"
ADD CONSTRAINT "ReporterOnboardingOrder_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "ReporterDesignation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
