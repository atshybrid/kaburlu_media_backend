-- Survey v2: GENERAL vs POLITICAL_PARTY, frame image, campaign status, admin review, area reports support

CREATE TYPE "UnionMemberSurveyType" AS ENUM ('GENERAL', 'POLITICAL_PARTY');
CREATE TYPE "UnionMemberSurveyCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "UnionMemberSurveyReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "UnionMemberSurveyCampaign"
  ADD COLUMN IF NOT EXISTS "surveyType" "UnionMemberSurveyType" NOT NULL DEFAULT 'POLITICAL_PARTY',
  ADD COLUMN IF NOT EXISTS "politicalPartyId" TEXT,
  ADD COLUMN IF NOT EXISTS "frameImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "campaignStatus" "UnionMemberSurveyCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "requiresReview" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);

ALTER TABLE "UnionMemberSurveyCampaign"
  ALTER COLUMN "partyCode" SET DEFAULT 'OTHER';

ALTER TABLE "UnionMemberSurveyProgress"
  ADD COLUMN IF NOT EXISTS "reviewStatus" "UnionMemberSurveyReviewStatus",
  ADD COLUMN IF NOT EXISTS "reviewNote" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedByUserId" TEXT;

-- Existing active campaigns → ACTIVE status
UPDATE "UnionMemberSurveyCampaign"
SET "campaignStatus" = 'ACTIVE'
WHERE "isActive" = true AND "campaignStatus" = 'DRAFT';

CREATE INDEX IF NOT EXISTS "UnionMemberSurveyCampaign_surveyType_idx" ON "UnionMemberSurveyCampaign"("surveyType");
CREATE INDEX IF NOT EXISTS "UnionMemberSurveyCampaign_politicalPartyId_idx" ON "UnionMemberSurveyCampaign"("politicalPartyId");
CREATE INDEX IF NOT EXISTS "UnionMemberSurveyCampaign_campaignStatus_idx" ON "UnionMemberSurveyCampaign"("campaignStatus");
CREATE INDEX IF NOT EXISTS "UnionMemberSurveyProgress_reviewStatus_idx" ON "UnionMemberSurveyProgress"("reviewStatus");

ALTER TABLE "UnionMemberSurveyCampaign"
  ADD CONSTRAINT "UnionMemberSurveyCampaign_politicalPartyId_fkey"
  FOREIGN KEY ("politicalPartyId") REFERENCES "IndianPoliticalParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
