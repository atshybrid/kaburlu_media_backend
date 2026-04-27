-- ============================================================
-- Migration: journalist_card_renewal_area
-- Changes:
--   JournalistProfile  — add state, mandal text fields (member operating area)
--   JournalistCard     — add renewal tracking fields + indexes
-- Zero data loss — all ADD COLUMN with sensible defaults.
-- ============================================================

-- Step 1: Member geographic area fields on JournalistProfile
ALTER TABLE "JournalistProfile"
    ADD COLUMN "state"  TEXT,
    ADD COLUMN "mandal" TEXT;

-- Step 2: Renewal tracking fields on JournalistCard
ALTER TABLE "JournalistCard"
    ADD COLUMN "issuedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "renewalCount"     INTEGER      NOT NULL DEFAULT 0,
    ADD COLUMN "pendingRenewal"   BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN "pendingRenewalAt" TIMESTAMP(3),
    ADD COLUMN "renewedAt"        TIMESTAMP(3);

-- Step 3: Back-fill issuedAt from createdAt for existing cards
UPDATE "JournalistCard" SET "issuedAt" = "createdAt" WHERE "issuedAt" = CURRENT_TIMESTAMP;

-- Step 4: New indexes
CREATE INDEX "JournalistCard_expiryDate_idx"      ON "JournalistCard"("expiryDate");
CREATE INDEX "JournalistCard_pendingRenewal_idx"   ON "JournalistCard"("pendingRenewal");
