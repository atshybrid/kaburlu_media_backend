-- Tenant Subscription & Wallet Balance System Migration

-- 1. Extend BillingComponent enum
ALTER TYPE "BillingComponent" ADD VALUE IF NOT EXISTS 'EPAPER_PAGE';
ALTER TYPE "BillingComponent" ADD VALUE IF NOT EXISTS 'NEWS_WEBSITE_MONTHLY';
ALTER TYPE "BillingComponent" ADD VALUE IF NOT EXISTS 'PRINT_MONTHLY';
ALTER TYPE "BillingComponent" ADD VALUE IF NOT EXISTS 'CUSTOM_SERVICE';

-- 2. Create WalletTransactionType enum (safe)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTransactionType') THEN
        CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT', 'LOCK', 'UNLOCK', 'REFUND', 'ADJUSTMENT');
    END IF;
END $$;

-- 3. Create TenantService enum (safe)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantService') THEN
        CREATE TYPE "TenantService" AS ENUM ('EPAPER', 'NEWS_WEBSITE', 'PRINT_SERVICE', 'CUSTOM_SERVICE');
    END IF;
END $$;

-- 4. Create TenantWallet table (safe)
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

-- 5. Create WalletTransaction table (safe)
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

-- 6. Create TenantPricing table (safe)
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

-- 7. Create TenantUsageMonthly table (safe)
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

-- 8. Add subscription lock fields to Tenant (safe)
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

-- 9. Create unique indexes (safe)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TenantWallet_tenantId_key') THEN
        CREATE UNIQUE INDEX "TenantWallet_tenantId_key" ON "TenantWallet"("tenantId");
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TenantUsageMonthly_tenantId_year_month_service_key') THEN
        CREATE UNIQUE INDEX "TenantUsageMonthly_tenantId_year_month_service_key" 
        ON "TenantUsageMonthly"("tenantId", "year", "month", "service");
    END IF;
END $$;

-- 10. Create foreign key constraints (safe)
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
