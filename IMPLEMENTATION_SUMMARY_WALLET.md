# Tenant Subscription & Wallet System - Implementation Summary

## ✅ Completed

### 1. Database Schema
- ✅ Extended `BillingComponent` enum (EPAPER_PAGE, NEWS_WEBSITE_MONTHLY, PRINT_MONTHLY, CUSTOM_SERVICE)
- ✅ Added new enums: `WalletTransactionType`, `TenantService`
- ✅ Created `TenantWallet` model (balance, locked balance, transactions)
- ✅ Created `WalletTransaction` model (full transaction history)
- ✅ Created `TenantPricing` model (tenant-specific pricing configuration)
- ✅ Created `TenantUsageMonthly` model (monthly usage tracking)
- ✅ Added `Tenant` fields: `subscriptionLocked`, `lockedReason`, `lockedAt`
- ✅ Migration file created: `prisma/migrations/20250127000001_tenant_subscription_wallet/migration.sql`

### 2. Business Logic Services
- ✅ `src/services/wallet/wallet.service.ts` - Wallet operations (credit, debit, lock, unlock, transactions)
- ✅ `src/services/wallet/billing.service.ts` - Billing calculations, usage tracking, invoice generation

### 3. Middleware
- ✅ `src/middleware/subscriptionAccess.ts` - Login access control based on balance

### 4. API Controllers
- ✅ `src/api/wallet/wallet.controller.ts` - Admin wallet management APIs
- ✅ `src/api/wallet/tenant.controller.ts` - Tenant self-service APIs
- ✅ `src/api/wallet/pricing.controller.ts` - Pricing configuration APIs

### 5. API Routes
- ✅ `src/api/wallet/wallet.routes.ts` - Admin routes with Swagger docs
- ✅ `src/api/wallet/tenant.routes.ts` - Tenant self-service routes
- ✅ `src/api/wallet/pricing.routes.ts` - Pricing management routes
- ✅ Mounted in `src/app.ts` (both legacy and `/api/v1` paths)

### 6. Automatic Tracking
- ✅ ePaper page count automatically tracked on PDF upload (in `pdfIssues.controller.ts`)

---

## 📋 Next Steps (Manual Actions Required)

### Step 1: Run Database Migration

```bash
# Generate Prisma client with new schema
npm run prisma:generate

# Run migration
npm run prisma:migrate:dev
# Or for production:
npm run prisma:migrate:deploy
```

### Step 2: Backfill Existing Tenants

Create default pricing and wallets for existing tenants:

```bash
node scripts/backfill-tenant-wallets.js
```

**Script to create** (`scripts/backfill-tenant-wallets.js`):
```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillTenantWallets() {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true }
  });

  for (const tenant of tenants) {
    console.log(`Processing tenant: ${tenant.name} (${tenant.id})`);

    // 1. Create wallet if not exists
    const wallet = await prisma.tenantWallet.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        balanceMinor: 0,
        lockedBalanceMinor: 0,
        currency: 'INR'
      },
      update: {}
    });
    console.log(`  ✓ Wallet created/exists`);

    // 2. Create default ePaper pricing (₹2000/page, min 8 pages)
    const pricing = await prisma.tenantPricing.upsert({
      where: {
        tenantId_service_effectiveFrom: {
          tenantId: tenant.id,
          service: 'EPAPER',
          effectiveFrom: new Date()
        }
      },
      create: {
        tenantId: tenant.id,
        service: 'EPAPER',
        minEpaperPages: 8,
        pricePerPageMinor: 200000, // ₹2000 in paise
        discount6MonthPercent: 5.0,
        discount12MonthPercent: 15.0,
        isActive: true
      },
      update: {}
    });
    console.log(`  ✓ Pricing configured: ₹2000/page, min 8 pages`);
  }

  console.log(`\n✅ Backfill complete for ${tenants.length} tenants`);
}

backfillTenantWallets()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Step 3: Add Cron Jobs

#### A. Monthly Invoice Generation (Run on 1st of every month)

Add to `ecosystem.config.cjs` or similar:

```javascript
// Create: src/workers/monthlyBilling.ts
import prisma from '../lib/prisma';
import { generateMonthlyInvoice, getPreviousMonthPeriod } from '../services/wallet/billing.service';

async function runMonthlyBilling() {
  console.log('Starting monthly billing job...');
  const previousMonth = getPreviousMonthPeriod();
  
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true, subscriptionLocked: false }
  });

  console.log(`Processing ${tenants.length} active tenants...`);

  for (const tenant of tenants) {
    try {
      const invoice = await generateMonthlyInvoice(
        tenant.id,
        previousMonth.start,
        previousMonth.end
      );
      
      if (invoice) {
        console.log(`✓ Invoice generated for ${tenant.name}: ${invoice.id}`);
      } else {
        console.log(`- No charges for ${tenant.name}`);
      }
    } catch (error) {
      console.error(`✗ Failed to generate invoice for ${tenant.name}:`, error);
    }
  }

  console.log('Monthly billing job complete');
}

runMonthlyBilling()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Cron schedule**: `0 0 1 * *` (Midnight on 1st of every month)

#### B. Daily Balance Check & Notifications

```javascript
// Create: src/workers/balanceCheck.ts
import prisma from '../lib/prisma';
import { checkTenantBalance } from '../services/wallet/billing.service';

async function runDailyBalanceCheck() {
  console.log('Starting daily balance check...');
  
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true, subscriptionLocked: false }
  });

  for (const tenant of tenants) {
    try {
      const balance = await checkTenantBalance(tenant.id);
      
      if (balance.monthsRemaining < 1.5 && balance.monthsRemaining >= 1) {
        console.log(`⚠️  Low balance: ${tenant.name} (${balance.monthsRemaining.toFixed(1)} months remaining)`);
        // TODO: Send notification to tenant admin
      } else if (balance.monthsRemaining < 1) {
        console.log(`❌ Critical balance: ${tenant.name} (${balance.monthsRemaining.toFixed(1)} months remaining)`);
        // TODO: Send urgent notification
      }
    } catch (error) {
      console.error(`Error checking balance for ${tenant.name}:`, error);
    }
  }

  console.log('Daily balance check complete');
}

runDailyBalanceCheck()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Cron schedule**: `0 8 * * *` (8 AM daily)

### Step 4: Apply Subscription Access Middleware

Add to protected login routes in `src/api/auth/auth.routes.ts`:

```typescript
import { checkTenantSubscriptionAccess } from '../../middleware/subscriptionAccess';

// Apply to tenant admin and reporter login/protected routes
router.post('/login', checkTenantSubscriptionAccess, loginController);
router.get('/me', 
  passport.authenticate('jwt', { session: false }),
  checkTenantSubscriptionAccess,
  getMeController
);
```

### Step 5: Initial Tenant Setup (Per Tenant)

For each tenant, super admin must:

1. **Set pricing**:
```bash
POST /api/v1/admin/tenants/{tenantId}/pricing
{
  "service": "EPAPER",
  "minEpaperPages": 8,
  "pricePerPageMinor": 200000,  # ₹2000/page
  "discount6MonthPercent": 5.0,
  "discount12MonthPercent": 15.0
}
```

2. **Add initial balance** (3 months minimum):
```bash
# Calculate: 8 pages × ₹2000 × 3 months = ₹48,000
POST /api/v1/admin/tenants/{tenantId}/wallet/topup
{
  "amountMinor": 4800000,  # ₹48,000 in paise
  "description": "Initial 3-month advance payment"
}
```

---

## 🎯 Testing Checklist

### Unit Tests
- [ ] Wallet credit/debit operations
- [ ] Balance lock/unlock
- [ ] Monthly charge calculation
- [ ] Bulk discount calculation
- [ ] Transaction history pagination

### Integration Tests
- [ ] ePaper upload → auto page tracking
- [ ] Monthly invoice generation
- [ ] Wallet deduction on invoice
- [ ] Login blocking when balance < 1 month
- [ ] Tenant unlock after top-up

### API Tests
```bash
# 1. Check wallet balance
GET /api/v1/admin/tenants/{tenantId}/wallet

# 2. Top-up wallet
POST /api/v1/admin/tenants/{tenantId}/wallet/topup
{
  "amountMinor": 1000000,
  "description": "Test top-up"
}

# 3. Check current usage
GET /api/v1/admin/tenants/{tenantId}/usage/current

# 4. Calculate bulk discount
POST /api/v1/admin/tenants/{tenantId}/wallet/calculate-bulk
{
  "months": 12
}

# 5. Tenant self-service: check my balance
GET /api/v1/tenant/wallet/balance

# 6. Get my transactions
GET /api/v1/tenant/wallet/transactions?page=1&pageSize=20
```

---

## 📚 API Documentation

All APIs now available at:
- **Swagger UI**: `http://localhost:3000/api/v1/docs`
- **Tags**: 
  - `Tenant Wallet`
  - `Tenant Billing`
  - `Tenant Pricing`
  - `Tenant Services`
  - `Tenant Wallet (Self-Service)`
  - `Tenant Billing (Self-Service)`

---

## 🔧 Configuration

### Environment Variables (Optional)
```env
# Wallet system config (defaults provided in code)
MINIMUM_ADVANCE_MONTHS=3
LOGIN_BLOCK_THRESHOLD_MONTHS=1
DEFAULT_EPAPER_MIN_PAGES=8
DEFAULT_EPAPER_PRICE_MINOR=200000  # ₹2000
DEFAULT_6_MONTH_DISCOUNT=5.0
DEFAULT_12_MONTH_DISCOUNT=15.0
```

---

## 🚀 Deployment

### Pre-Deployment Checklist
1. [ ] Run migration in staging first
2. [ ] Backfill existing tenants
3. [ ] Set up cron jobs
4. [ ] Test API endpoints
5. [ ] Configure pricing for all tenants
6. [ ] Add initial wallet balance for all tenants

### Post-Deployment
1. [ ] Monitor first monthly billing run (on 1st)
2. [ ] Check daily balance notifications
3. [ ] Verify ePaper uploads track correctly
4. [ ] Test login blocking when balance is low

---

## 📞 Support

If you encounter issues:
1. Check logs for transaction failures
2. Verify tenant wallet exists (`GET /api/v1/admin/tenants/{tenantId}/wallet`)
3. Check tenant pricing is configured (`GET /api/v1/admin/tenants/{tenantId}/pricing`)
4. Review usage tracking (`GET /api/v1/admin/tenants/{tenantId}/usage/current`)

---

## Implementation Summary

✅ **Schema**: 4 new tables, 3 new enums, migration ready  
✅ **Services**: Wallet + Billing business logic complete  
✅ **APIs**: 20+ endpoints (admin + self-service)  
✅ **Automation**: ePaper page tracking on upload  
✅ **Middleware**: Login access control  
✅ **Documentation**: Full Swagger API docs

**Ready for**: Migration → Backfill → Cron setup → Production
