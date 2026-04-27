-- ============================================================
-- Migration: journalist_union_multistate
-- Changes to JournalistUnionSettings:
--   - Add "states" TEXT[] column (list of all states covered)
--   - Add "primaryState" TEXT column (replaces old "state" as kept compat alias)
--   - Rename "state" → "primaryState" (backfill existing row)
--   - Drop old "presidentSignatureUrl" (moved to per-state table)
-- New table: JournalistUnionStateSettings (per-state overrides)
-- ============================================================

-- Step 1: Add new columns to JournalistUnionSettings
ALTER TABLE "JournalistUnionSettings"
    ADD COLUMN "states"        TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN "primaryState"  TEXT;

-- Step 2: Backfill primaryState from old "state" column
UPDATE "JournalistUnionSettings"
SET    "primaryState" = "state",
       "states"       = CASE WHEN "state" IS NOT NULL THEN ARRAY["state"] ELSE '{}' END
WHERE  "state" IS NOT NULL;

-- Step 3: Drop old single-state columns (state + presidentSignatureUrl moved to state-level)
ALTER TABLE "JournalistUnionSettings"
    DROP COLUMN IF EXISTS "state",
    DROP COLUMN IF EXISTS "presidentSignatureUrl";

-- Step 4: Re-create index on primaryState (replaced state index)
DROP INDEX IF EXISTS "JournalistUnionSettings_state_idx";
CREATE INDEX "JournalistUnionSettings_primaryState_idx"
    ON "JournalistUnionSettings"("primaryState");

-- Step 5: Create JournalistUnionStateSettings table
CREATE TABLE "JournalistUnionStateSettings" (
    "id"                    TEXT         NOT NULL,
    "unionName"             TEXT         NOT NULL,
    "state"                 TEXT         NOT NULL,
    "address"               TEXT,
    "email"                 TEXT,
    "phone"                 TEXT,
    "presidentSignatureUrl" TEXT,
    "stateLogoUrl"          TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalistUnionStateSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JournalistUnionStateSettings_unionName_state_key"
    ON "JournalistUnionStateSettings"("unionName", "state");

CREATE INDEX "JournalistUnionStateSettings_unionName_idx"
    ON "JournalistUnionStateSettings"("unionName");

ALTER TABLE "JournalistUnionStateSettings"
    ADD CONSTRAINT "JournalistUnionStateSettings_unionName_fkey"
    FOREIGN KEY ("unionName") REFERENCES "JournalistUnionSettings"("unionName")
    ON DELETE CASCADE ON UPDATE CASCADE;
