-- Journalist Union Module
-- Adds: JournalistProfile, JournalistCard, JournalistComplaint, JournalistUnionUpdate
-- New enums: JournalistCardStatus, JournalistComplaintStatus

-- CreateEnum
CREATE TYPE "JournalistCardStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "JournalistComplaintStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');

-- CreateTable: journalist membership application / profile
CREATE TABLE "JournalistProfile" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "pressId"      TEXT,
    "designation"  TEXT NOT NULL,
    "district"     TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "unionName"    TEXT,
    "approved"     BOOLEAN NOT NULL DEFAULT false,
    "approvedAt"   TIMESTAMP(3),
    "rejectedAt"   TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalistProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable: press card
CREATE TABLE "JournalistCard" (
    "id"         TEXT NOT NULL,
    "profileId"  TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "qrCode"     TEXT,
    "pdfUrl"     TEXT,
    "status"     "JournalistCardStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalistCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable: complaint
CREATE TABLE "JournalistComplaint" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location"    TEXT,
    "status"      "JournalistComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalistComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable: union announcements
CREATE TABLE "JournalistUnionUpdate" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "unionName"   TEXT,
    "imageUrl"    TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalistUnionUpdate_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "JournalistProfile_userId_key"  ON "JournalistProfile"("userId");
CREATE UNIQUE INDEX "JournalistProfile_pressId_key" ON "JournalistProfile"("pressId");
CREATE UNIQUE INDEX "JournalistCard_profileId_key"  ON "JournalistCard"("profileId");
CREATE UNIQUE INDEX "JournalistCard_cardNumber_key" ON "JournalistCard"("cardNumber");

-- Indexes
CREATE INDEX "JournalistProfile_approved_idx"  ON "JournalistProfile"("approved");
CREATE INDEX "JournalistProfile_district_idx"  ON "JournalistProfile"("district");
CREATE INDEX "JournalistProfile_unionName_idx" ON "JournalistProfile"("unionName");
CREATE INDEX "JournalistCard_status_idx"        ON "JournalistCard"("status");
CREATE INDEX "JournalistComplaint_userId_idx"   ON "JournalistComplaint"("userId");
CREATE INDEX "JournalistComplaint_status_idx"   ON "JournalistComplaint"("status");
CREATE INDEX "JournalistUnionUpdate_unionName_idx" ON "JournalistUnionUpdate"("unionName");
CREATE INDEX "JournalistUnionUpdate_createdAt_idx" ON "JournalistUnionUpdate"("createdAt");

-- Foreign Keys
ALTER TABLE "JournalistProfile"     ADD CONSTRAINT "JournalistProfile_userId_fkey"
    FOREIGN KEY ("userId")      REFERENCES "User"("id")             ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalistCard"        ADD CONSTRAINT "JournalistCard_profileId_fkey"
    FOREIGN KEY ("profileId")   REFERENCES "JournalistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalistComplaint"   ADD CONSTRAINT "JournalistComplaint_userId_fkey"
    FOREIGN KEY ("userId")      REFERENCES "User"("id")             ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalistUnionUpdate" ADD CONSTRAINT "JournalistUnionUpdate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")             ON DELETE CASCADE ON UPDATE CASCADE;
