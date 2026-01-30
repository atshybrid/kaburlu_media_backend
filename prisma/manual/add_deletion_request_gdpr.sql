-- GDPR Compliance: DeletionRequest table
-- Migration: add_deletion_request_gdpr
-- Date: 2026-01-30

-- Create enum for deletion request status
CREATE TYPE "DeletionRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- Create DeletionRequest table for GDPR Article 17 (Right to Erasure)
CREATE TABLE "DeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'user_requested',
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- Create indexes for efficient querying
CREATE INDEX "DeletionRequest_userId_idx" ON "DeletionRequest"("userId");
CREATE INDEX "DeletionRequest_status_idx" ON "DeletionRequest"("status");

-- Note: No foreign key to User table as we want to keep deletion requests
-- even after user is deleted for audit purposes
