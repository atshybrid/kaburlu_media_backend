-- Add subscriptionActivationDate to Reporter and ReporterOnboardingOrder tables
ALTER TABLE "Reporter" ADD COLUMN IF NOT EXISTS "subscriptionActivationDate" TIMESTAMP(3);
ALTER TABLE "ReporterOnboardingOrder" ADD COLUMN IF NOT EXISTS "subscriptionActivationDate" TIMESTAMP(3);

-- Add index for efficient querying of scheduled activations
CREATE INDEX IF NOT EXISTS "Reporter_subscriptionActivationDate_idx" 
  ON "Reporter"("subscriptionActivationDate") 
  WHERE "subscriptionActive" = false AND "subscriptionActivationDate" IS NOT NULL;
