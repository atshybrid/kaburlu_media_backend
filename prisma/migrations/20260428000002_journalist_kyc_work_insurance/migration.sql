-- ============================================================
-- Migration: journalist_kyc_work_insurance
-- Changes:
--   JournalistProfile — add KYC + work/career fields
--   JournalistInsuranceType enum — new
--   JournalistInsurance table — new (accidental + health)
-- Zero data loss — all new nullable columns and new table.
-- ============================================================

-- Step 1: KYC fields on JournalistProfile
ALTER TABLE "JournalistProfile"
    ADD COLUMN "photoUrl"             TEXT,
    ADD COLUMN "aadhaarUrl"           TEXT,
    ADD COLUMN "aadhaarBackUrl"       TEXT,
    ADD COLUMN "aadhaarNumber"        TEXT,
    ADD COLUMN "kycVerified"          BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "kycVerifiedAt"        TIMESTAMP(3),
    ADD COLUMN "kycNote"              TEXT;

-- Step 2: Work/career fields on JournalistProfile
ALTER TABLE "JournalistProfile"
    ADD COLUMN "linkedTenantId"       TEXT,
    ADD COLUMN "linkedTenantName"     TEXT,
    ADD COLUMN "currentNewspaper"     TEXT,
    ADD COLUMN "currentDesignation"   TEXT,
    ADD COLUMN "joiningDate"          TIMESTAMP(3),
    ADD COLUMN "totalExperienceYears" INTEGER,
    ADD COLUMN "additionalInfo"       TEXT;

-- Step 3: Indexes on new JournalistProfile columns
CREATE INDEX "JournalistProfile_kycVerified_idx"  ON "JournalistProfile"("kycVerified");
CREATE INDEX "JournalistProfile_linkedTenantId_idx" ON "JournalistProfile"("linkedTenantId");

-- Step 4: Insurance enum
CREATE TYPE "JournalistInsuranceType" AS ENUM ('ACCIDENTAL', 'HEALTH');

-- Step 5: JournalistInsurance table
CREATE TABLE "JournalistInsurance" (
    "id"           TEXT                       NOT NULL,
    "profileId"    TEXT                       NOT NULL,
    "type"         "JournalistInsuranceType"  NOT NULL,
    "policyNumber" TEXT                       NOT NULL,
    "insurer"      TEXT                       NOT NULL,
    "coverAmount"  INTEGER,
    "premium"      INTEGER,
    "validFrom"    TIMESTAMP(3)               NOT NULL,
    "validTo"      TIMESTAMP(3)               NOT NULL,
    "isActive"     BOOLEAN                    NOT NULL DEFAULT true,
    "notes"        TEXT,
    "assignedById" TEXT                       NOT NULL,
    "createdAt"    TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)               NOT NULL,

    CONSTRAINT "JournalistInsurance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JournalistInsurance_profileId_idx" ON "JournalistInsurance"("profileId");
CREATE INDEX "JournalistInsurance_type_idx"      ON "JournalistInsurance"("type");
CREATE INDEX "JournalistInsurance_isActive_idx"  ON "JournalistInsurance"("isActive");
CREATE INDEX "JournalistInsurance_validTo_idx"   ON "JournalistInsurance"("validTo");

ALTER TABLE "JournalistInsurance"
    ADD CONSTRAINT "JournalistInsurance_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "JournalistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalistInsurance"
    ADD CONSTRAINT "JournalistInsurance_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
