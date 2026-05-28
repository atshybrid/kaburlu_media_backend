-- Journalist union member type + per-document approval workflow
CREATE TYPE "JournalistMemberType" AS ENUM ('TENANT_REPORTER', 'NON_TENANT_REPORTER');
CREATE TYPE "JournalistDocumentApprovalStatus" AS ENUM ('NOT_UPLOADED', 'PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "JournalistProfile"
  ADD COLUMN "memberType" "JournalistMemberType",
  ADD COLUMN "fatherName" TEXT,
  ADD COLUMN "workingArea" TEXT,
  ADD COLUMN "workingIdCardUrl" TEXT,
  ADD COLUMN "publisherMobileNumber" TEXT,
  ADD COLUMN "photoApprovalStatus" "JournalistDocumentApprovalStatus" NOT NULL DEFAULT 'NOT_UPLOADED',
  ADD COLUMN "aadhaarApprovalStatus" "JournalistDocumentApprovalStatus" NOT NULL DEFAULT 'NOT_UPLOADED',
  ADD COLUMN "panApprovalStatus" "JournalistDocumentApprovalStatus" NOT NULL DEFAULT 'NOT_UPLOADED',
  ADD COLUMN "workingIdCardApprovalStatus" "JournalistDocumentApprovalStatus" NOT NULL DEFAULT 'NOT_UPLOADED',
  ADD COLUMN "photoApprovedAt" TIMESTAMP(3),
  ADD COLUMN "aadhaarApprovedAt" TIMESTAMP(3),
  ADD COLUMN "panApprovedAt" TIMESTAMP(3),
  ADD COLUMN "workingIdCardApprovedAt" TIMESTAMP(3);

CREATE INDEX "JournalistProfile_memberType_idx" ON "JournalistProfile"("memberType");
