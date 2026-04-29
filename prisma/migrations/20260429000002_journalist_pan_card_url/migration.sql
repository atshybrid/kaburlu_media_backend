-- AlterTable: add panCardUrl to JournalistProfile for WhatsApp KYC PAN card upload
ALTER TABLE "JournalistProfile" ADD COLUMN IF NOT EXISTS "panCardUrl" TEXT;
