-- Fix migration: Handle existing wallet enums and tables
-- This migration safely creates objects only if they don't exist

-- Create WalletTransactionType enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTransactionType') THEN
        CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT', 'LOCK', 'UNLOCK', 'REFUND', 'ADJUSTMENT');
    END IF;
END $$;

-- Create TenantService enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantService') THEN
        CREATE TYPE "TenantService" AS ENUM ('EPAPER', 'NEWS_WEBSITE', 'PRINT_SERVICE', 'CUSTOM_SERVICE');
    END IF;
END $$;

-- Create TenantWallet table if it doesn't exist
CREATE TABLE IF NOT EXISTS "TenantWallet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "balanceMinor" INTEGER NOT NULL DEFAULT 0,
    "lockedBalanceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantWallet_pkey" PRIMARY KEY ("id")
);

-- Create WalletTransaction table if it doesn't exist
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "balanceAfterMinor" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- Create TenantPricing table if it doesn't exist
CREATE TABLE IF NOT EXISTS "TenantPricing" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "service" "TenantService" NOT NULL,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'INR',
    "minEpaperPages" INTEGER,
    "pricePerPageMinor" INTEGER,
    "newsWebsiteFeeMonthlyMinor" INTEGER,
    "printServiceFeeMonthlyMinor" INTEGER,
    "customServiceFeeMinor" INTEGER,
    "discount6MonthPercent" DOUBLE PRECISION,
    "discount12MonthPercent" DOUBLE PRECISION,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantPricing_pkey" PRIMARY KEY ("id")
);

-- Create TenantUsageMonthly table if it doesn't exist
CREATE TABLE IF NOT EXISTS "TenantUsageMonthly" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "service" "TenantService" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "totalAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" "BillingCurrency" NOT NULL DEFAULT 'INR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantUsageMonthly_pkey" PRIMARY KEY ("id")
);

-- Add missing columns to TenantUsageMonthly if table exists but columns don't (recovery)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'TenantUsageMonthly') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TenantUsageMonthly' AND column_name = 'year') THEN
            ALTER TABLE "TenantUsageMonthly" ADD COLUMN "year" INTEGER NOT NULL DEFAULT 2026;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TenantUsageMonthly' AND column_name = 'month') THEN
            ALTER TABLE "TenantUsageMonthly" ADD COLUMN "month" INTEGER NOT NULL DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TenantUsageMonthly' AND column_name = 'service') THEN
            ALTER TABLE "TenantUsageMonthly" ADD COLUMN "service" "TenantService" NOT NULL DEFAULT 'EPAPER';
        END IF;
    END IF;
END $$;

-- Add subscription lock fields to Tenant if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'Tenant' AND column_name = 'subscriptionLocked') THEN
        ALTER TABLE "Tenant" ADD COLUMN "subscriptionLocked" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'Tenant' AND column_name = 'lockedReason') THEN
        ALTER TABLE "Tenant" ADD COLUMN "lockedReason" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'Tenant' AND column_name = 'lockedAt') THEN
        ALTER TABLE "Tenant" ADD COLUMN "lockedAt" TIMESTAMP(3);
    END IF;
END $$;

-- Create unique indexes if they don't exist (with column checks)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TenantWallet_tenantId_key') THEN
        CREATE UNIQUE INDEX "TenantWallet_tenantId_key" ON "TenantWallet"("tenantId");
    END IF;
    
    -- Only create TenantUsageMonthly index if all required columns exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'TenantUsageMonthly')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TenantUsageMonthly' AND column_name = 'tenantId')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TenantUsageMonthly' AND column_name = 'year')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TenantUsageMonthly' AND column_name = 'month')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'TenantUsageMonthly' AND column_name = 'service')
       AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TenantUsageMonthly_tenantId_year_month_service_key') THEN
        CREATE UNIQUE INDEX "TenantUsageMonthly_tenantId_year_month_service_key" 
        ON "TenantUsageMonthly"("tenantId", "year", "month", "service");
    END IF;
END $$;

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantWallet_tenantId_fkey') THEN
        ALTER TABLE "TenantWallet" 
        ADD CONSTRAINT "TenantWallet_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_walletId_fkey') THEN
        ALTER TABLE "WalletTransaction" 
        ADD CONSTRAINT "WalletTransaction_walletId_fkey" 
        FOREIGN KEY ("walletId") REFERENCES "TenantWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantPricing_tenantId_fkey') THEN
        ALTER TABLE "TenantPricing" 
        ADD CONSTRAINT "TenantPricing_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TenantUsageMonthly_tenantId_fkey') THEN
        ALTER TABLE "TenantUsageMonthly" 
        ADD CONSTRAINT "TenantUsageMonthly_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
