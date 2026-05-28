-- Union Member Survey & Benefits (party tracks, insurance unlock)

CREATE TYPE "UnionPoliticalPartyCode" AS ENUM ('BJP', 'CONGRESS', 'BRS', 'TRS', 'OTHER');
CREATE TYPE "UnionSurveyQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'YES_NO', 'TEXT', 'VIDEO_UPLOAD');
CREATE TYPE "UnionMemberSurveyStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE "JournalistUnionSettings"
  ADD COLUMN IF NOT EXISTS "benefitFirstMembershipFree" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "benefitAccidentalRequiresSurvey" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "benefitHealthRequiresAccidental" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "UnionMemberSurveyCampaign" (
  "id" TEXT NOT NULL,
  "unionName" TEXT NOT NULL,
  "state" TEXT,
  "partyCode" "UnionPoliticalPartyCode" NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "logoUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#0D47A1',
  "secondaryColor" TEXT NOT NULL DEFAULT '#FFB300',
  "frameStyleKey" TEXT,
  "requiredForInsuranceType" "JournalistInsuranceType",
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnionMemberSurveyCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnionMemberSurveyQuestion" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "questionText" TEXT NOT NULL,
  "nativeQuestionText" TEXT,
  "questionType" "UnionSurveyQuestionType" NOT NULL,
  "options" JSONB,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "videoMaxSeconds" INTEGER,
  "yesCount" INTEGER NOT NULL DEFAULT 0,
  "noCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnionMemberSurveyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnionMemberSurveyProgress" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "status" "UnionMemberSurveyStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnionMemberSurveyProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnionMemberSurveyAnswer" (
  "id" TEXT NOT NULL,
  "progressId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answerText" TEXT,
  "answerJson" JSONB,
  "yesNoValue" TEXT,
  "videoUrl" TEXT,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnionMemberSurveyAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UnionMemberBenefitStatus" (
  "profileId" TEXT NOT NULL,
  "unionName" TEXT NOT NULL,
  "firstMembershipWaived" BOOLEAN NOT NULL DEFAULT true,
  "firstMembershipWaivedAt" TIMESTAMP(3),
  "accidentalUnlockedAt" TIMESTAMP(3),
  "healthUnlockedAt" TIMESTAMP(3),
  "accidentalInsuranceActive" BOOLEAN NOT NULL DEFAULT false,
  "healthInsuranceActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UnionMemberBenefitStatus_pkey" PRIMARY KEY ("profileId")
);

CREATE UNIQUE INDEX "UnionMemberSurveyProgress_campaignId_profileId_key" ON "UnionMemberSurveyProgress"("campaignId", "profileId");
CREATE UNIQUE INDEX "UnionMemberSurveyAnswer_progressId_questionId_key" ON "UnionMemberSurveyAnswer"("progressId", "questionId");
CREATE INDEX "UnionMemberSurveyCampaign_unionName_state_isActive_idx" ON "UnionMemberSurveyCampaign"("unionName", "state", "isActive");
CREATE INDEX "UnionMemberSurveyQuestion_campaignId_sortOrder_idx" ON "UnionMemberSurveyQuestion"("campaignId", "sortOrder");
CREATE INDEX "UnionMemberSurveyProgress_profileId_idx" ON "UnionMemberSurveyProgress"("profileId");
CREATE INDEX "UnionMemberBenefitStatus_unionName_idx" ON "UnionMemberBenefitStatus"("unionName");

ALTER TABLE "UnionMemberSurveyQuestion" ADD CONSTRAINT "UnionMemberSurveyQuestion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "UnionMemberSurveyCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnionMemberSurveyProgress" ADD CONSTRAINT "UnionMemberSurveyProgress_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "UnionMemberSurveyCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnionMemberSurveyProgress" ADD CONSTRAINT "UnionMemberSurveyProgress_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "JournalistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnionMemberSurveyAnswer" ADD CONSTRAINT "UnionMemberSurveyAnswer_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "UnionMemberSurveyProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnionMemberSurveyAnswer" ADD CONSTRAINT "UnionMemberSurveyAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "UnionMemberSurveyQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnionMemberBenefitStatus" ADD CONSTRAINT "UnionMemberBenefitStatus_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "JournalistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
