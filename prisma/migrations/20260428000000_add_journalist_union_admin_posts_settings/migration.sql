-- ============================================================
-- Migration: add_journalist_union_admin_posts_settings
-- Adds:
--   JournalistUnionAdmin     — union-level admin scoping
--   JournalistPostLevel      — enum (STATE/DISTRICT/MANDAL/CITY/SPECIAL_WING)
--   JournalistPostType       — enum (ELECTED/APPOINTED)
--   JournalistUnionPostDefinition — post catalog
--   JournalistUnionPostHolder     — who holds which post / term
--   JournalistUnionSettings       — union branding & assets
-- All are NEW tables/enums — zero data loss risk.
-- ============================================================

-- CreateEnum
CREATE TYPE "JournalistPostLevel" AS ENUM (
  'STATE',
  'DISTRICT',
  'MANDAL',
  'CITY',
  'SPECIAL_WING'
);

-- CreateEnum
CREATE TYPE "JournalistPostType" AS ENUM (
  'ELECTED',
  'APPOINTED'
);

-- CreateTable: JournalistUnionAdmin
CREATE TABLE "JournalistUnionAdmin" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "unionName" TEXT         NOT NULL,
    "state"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalistUnionAdmin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JournalistUnionAdmin_userId_unionName_key"
    ON "JournalistUnionAdmin"("userId", "unionName");

CREATE INDEX "JournalistUnionAdmin_unionName_idx"
    ON "JournalistUnionAdmin"("unionName");

ALTER TABLE "JournalistUnionAdmin"
    ADD CONSTRAINT "JournalistUnionAdmin_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: JournalistUnionPostDefinition
CREATE TABLE "JournalistUnionPostDefinition" (
    "id"          TEXT                   NOT NULL,
    "unionName"   TEXT,
    "title"       TEXT                   NOT NULL,
    "nativeTitle" TEXT,
    "level"       "JournalistPostLevel"  NOT NULL,
    "type"        "JournalistPostType"   NOT NULL,
    "maxSeats"    INTEGER                NOT NULL DEFAULT 1,
    "sortOrder"   INTEGER                NOT NULL DEFAULT 0,
    "isActive"    BOOLEAN                NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3)           NOT NULL,

    CONSTRAINT "JournalistUnionPostDefinition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JournalistUnionPostDefinition_unionName_level_idx"
    ON "JournalistUnionPostDefinition"("unionName", "level");

CREATE INDEX "JournalistUnionPostDefinition_level_sortOrder_idx"
    ON "JournalistUnionPostDefinition"("level", "sortOrder");

-- CreateTable: JournalistUnionPostHolder
CREATE TABLE "JournalistUnionPostHolder" (
    "id"            TEXT         NOT NULL,
    "postId"        TEXT         NOT NULL,
    "profileId"     TEXT         NOT NULL,
    "unionName"     TEXT         NOT NULL,
    "stateId"       TEXT,
    "districtId"    TEXT,
    "mandalId"      TEXT,
    "termStartDate" TIMESTAMP(3) NOT NULL,
    "termEndDate"   TIMESTAMP(3),
    "isActive"      BOOLEAN      NOT NULL DEFAULT true,
    "appointedById" TEXT,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalistUnionPostHolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JournalistUnionPostHolder_unionName_isActive_idx"
    ON "JournalistUnionPostHolder"("unionName", "isActive");

CREATE INDEX "JournalistUnionPostHolder_profileId_idx"
    ON "JournalistUnionPostHolder"("profileId");

CREATE INDEX "JournalistUnionPostHolder_postId_idx"
    ON "JournalistUnionPostHolder"("postId");

CREATE INDEX "JournalistUnionPostHolder_districtId_idx"
    ON "JournalistUnionPostHolder"("districtId");

CREATE INDEX "JournalistUnionPostHolder_mandalId_idx"
    ON "JournalistUnionPostHolder"("mandalId");

ALTER TABLE "JournalistUnionPostHolder"
    ADD CONSTRAINT "JournalistUnionPostHolder_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "JournalistUnionPostDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "JournalistUnionPostHolder"
    ADD CONSTRAINT "JournalistUnionPostHolder_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "JournalistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalistUnionPostHolder"
    ADD CONSTRAINT "JournalistUnionPostHolder_appointedById_fkey"
    FOREIGN KEY ("appointedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: JournalistUnionSettings
CREATE TABLE "JournalistUnionSettings" (
    "id"                    TEXT         NOT NULL,
    "unionName"             TEXT         NOT NULL,
    "displayName"           TEXT,
    "registrationNumber"    TEXT,
    "address"               TEXT,
    "state"                 TEXT,
    "foundedYear"           INTEGER,
    "email"                 TEXT,
    "phone"                 TEXT,
    "websiteUrl"            TEXT,
    "logoUrl"               TEXT,
    "idCardLogoUrl"         TEXT,
    "stampImageUrl"         TEXT,
    "forStampImageUrl"      TEXT,
    "presidentSignatureUrl" TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalistUnionSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JournalistUnionSettings_unionName_key"
    ON "JournalistUnionSettings"("unionName");

CREATE INDEX "JournalistUnionSettings_state_idx"
    ON "JournalistUnionSettings"("state");
