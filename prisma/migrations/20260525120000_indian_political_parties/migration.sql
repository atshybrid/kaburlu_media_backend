-- Indian political parties (ECI names/symbols + brand colors for UI)

CREATE TYPE "PoliticalPartyRecognition" AS ENUM ('NATIONAL', 'STATE', 'REGISTERED_UNRECOGNIZED');
CREATE TYPE "PoliticalPartyColorSource" AS ENUM ('ECI', 'MANUAL', 'AI_CURATED');

CREATE TABLE "IndianPoliticalParty" (
  "id" TEXT NOT NULL,
  "shortCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "abbreviation" TEXT,
  "recognition" "PoliticalPartyRecognition" NOT NULL,
  "symbolName" TEXT,
  "symbolImageUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#1A237E',
  "secondaryColor" TEXT NOT NULL DEFAULT '#FFFFFF',
  "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "headquartersAddress" TEXT,
  "eciSerialNumber" INTEGER,
  "eciNotificationRef" TEXT,
  "eciSourceUrl" TEXT,
  "colorSource" "PoliticalPartyColorSource" NOT NULL DEFAULT 'MANUAL',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IndianPoliticalParty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IndianPoliticalParty_shortCode_key" ON "IndianPoliticalParty"("shortCode");
CREATE INDEX "IndianPoliticalParty_name_idx" ON "IndianPoliticalParty"("name");
CREATE INDEX "IndianPoliticalParty_recognition_idx" ON "IndianPoliticalParty"("recognition");
CREATE INDEX "IndianPoliticalParty_isActive_idx" ON "IndianPoliticalParty"("isActive");
CREATE INDEX "IndianPoliticalParty_recognition_isActive_idx" ON "IndianPoliticalParty"("recognition", "isActive");
