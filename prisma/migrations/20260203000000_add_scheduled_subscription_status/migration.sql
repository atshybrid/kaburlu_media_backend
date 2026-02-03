-- Add SCHEDULED status to SubscriptionStatus enum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
