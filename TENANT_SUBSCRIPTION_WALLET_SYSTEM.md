# Tenant Subscription & Wallet Balance System

## Overview
Complete billing system mana newspaper platform kosam (ePaper pages-based pricing + optional services + advance payment wallet).

## Industry Standard Approach
Follows **Stripe + AWS billing model**:
- **Wallet/Account Balance** → Advance payments track cheyyataniki
- **Usage-Based Billing** → ePaper pages count based monthly charges
- **Subscription Services** → Optional services (News website, Print, etc.)
- **Automated Invoicing** → Monthly period end ki auto-generate
- **Access Control** → Insufficient balance unte login block

---

## Core Requirements

### 1. ePaper Service (Primary Revenue)
- **Minimum pages**: 8 pages/month
- **Pricing**: Tenant-wise configurable (example: ₹1000/page or ₹2000/page)
- **Advance payment**: 3 months total
  - 1 month = current month charge
  - 2 months = advance deposit
- **Access rule**: Balance < 1 month charge → Block tenant admin + reporter login

### 2. Optional Services
- **News Website** (when ePaper not used):
  - Condition: Minimum 4 pages
  - Price: ₹3000/month (tenant-wise configurable)
- **Print Charges**: Monthly fee (tenant-specific)
- **Other Services**: Custom charges add cheyochu

### 3. Bulk Payment Discounts
- 6-month advance: 5-10% discount
- 12-month advance: 15-20% discount
- Discount percentages tenant-wise configure avutai

### 4. Wallet System
- Tenant maintains prepaid balance
- Super admin can add credits (top-up)
- Auto-deduct monthly charges
- Transaction history track

---

## Database Schema Design

### New Tables

#### 1. TenantWallet (Account Balance)
```prisma
model TenantWallet {
  id                String   @id @default(cuid())
  tenantId          String   @unique
  balanceMinor      Int      @default(0)  // in paise (₹100 = 10000)
  lockedBalanceMinor Int     @default(0)  // reserved for pending invoices
  currency          BillingCurrency @default(INR)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  tenant            Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  transactions      WalletTransaction[]
  
  @@index([tenantId])
}
```

#### 2. WalletTransaction (Transaction History)
```prisma
model WalletTransaction {
  id              String   @id @default(cuid())
  walletId        String
  type            WalletTransactionType
  amountMinor     Int      // positive = credit, negative = debit
  balanceAfterMinor Int    // snapshot after transaction
  description     String
  referenceType   String?  // INVOICE, TOPUP, REFUND, ADJUSTMENT
  referenceId     String?  // Related invoice/payment ID
  meta            Json?
  createdAt       DateTime @default(now())
  createdBy       String?  // User ID who performed action
  
  wallet          TenantWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)
  
  @@index([walletId, createdAt])
  @@index([referenceType, referenceId])
}

enum WalletTransactionType {
  CREDIT        // Money added
  DEBIT         // Money deducted
  LOCK          // Reserved for invoice
  UNLOCK        // Released lock
  REFUND        // Money returned
  ADJUSTMENT    // Manual correction
}
```

#### 3. TenantPricing (Tenant-Specific Rates)
```prisma
model TenantPricing {
  id                    String   @id @default(cuid())
  tenantId              String
  service               TenantService
  currency              BillingCurrency @default(INR)
  
  // ePaper specific
  minEpaperPages        Int?     @default(8)
  pricePerPageMinor     Int?     // ₹1000/page = 100000 minor
  
  // Fixed service pricing
  monthlyFeeMinor       Int?     // For NEWS_WEBSITE, PRINT, etc.
  
  // Bulk discounts
  discount6MonthPercent Decimal? @default(5.0) @db.Decimal(5, 2)
  discount12MonthPercent Decimal? @default(15.0) @db.Decimal(5, 2)
  
  isActive              Boolean  @default(true)
  effectiveFrom         DateTime @default(now())
  effectiveUntil        DateTime?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  tenant                Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, service, effectiveFrom])
  @@index([tenantId, isActive])
}

enum TenantService {
  EPAPER              // Page-based billing
  NEWS_WEBSITE        // Fixed monthly fee
  PRINT_SERVICE       // Fixed monthly fee
  CUSTOM_SERVICE      // Other services
}
```

#### 4. TenantUsageMonthly (Monthly Usage Tracking)
```prisma
model TenantUsageMonthly {
  id                String   @id @default(cuid())
  tenantId          String
  periodStart       DateTime // First day of month
  periodEnd         DateTime // Last day of month
  
  // ePaper usage
  epaperPageCount   Int      @default(0)
  epaperChargeMinor Int      @default(0)
  
  // Other services
  newsWebsiteActive Boolean  @default(false)
  newsWebsiteChargeMinor Int @default(0)
  
  printChargeMinor  Int      @default(0)
  otherChargesMinor Int      @default(0)
  
  totalChargeMinor  Int      @default(0)
  invoiceId         String?  @unique
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  tenant            Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  invoice           BillingInvoice? @relation(fields: [invoiceId], references: [id])
  
  @@unique([tenantId, periodStart])
  @@index([periodStart, periodEnd])
}
```

### Extend Existing Tables

#### Update BillingComponent enum
```prisma
enum BillingComponent {
  NEWS_DOMAIN
  EPAPER_SUBDOMAIN
  NEWSPAPER_DESIGN_PAGE
  EPAPER_PAGE            // NEW: Monthly ePaper pages
  NEWS_WEBSITE_MONTHLY   // NEW: News website fixed fee
  PRINT_MONTHLY          // NEW: Print service
  CUSTOM_SERVICE         // NEW: Other services
}
```

#### Update Tenant model
```prisma
model Tenant {
  // ... existing fields ...
  
  wallet            TenantWallet?
  pricing           TenantPricing[]
  usageMonthly      TenantUsageMonthly[]
  subscriptionLocked Boolean @default(false) // Access control flag
  lockedReason      String?
  lockedAt          DateTime?
}
```

---

## Business Logic Flow

### A. Initial Setup (One-time per tenant)

1. **Super Admin creates tenant pricing**
   ```typescript
   // Example: ₹2000 per ePaper page, minimum 8 pages
   POST /api/v1/admin/tenants/{tenantId}/pricing
   {
     "service": "EPAPER",
     "minEpaperPages": 8,
     "pricePerPageMinor": 200000,  // ₹2000 in paise
     "discount6MonthPercent": 5.0,
     "discount12MonthPercent": 15.0
   }
   ```

2. **Calculate minimum advance payment**
   ```
   Minimum 8 pages × ₹2000/page = ₹16,000/month
   3 months advance = ₹16,000 × 3 = ₹48,000
   ```

3. **Super admin adds initial balance**
   ```typescript
   POST /api/v1/admin/tenants/{tenantId}/wallet/topup
   {
     "amountMinor": 4800000,  // ₹48,000
     "description": "Initial 3-month advance (8 pages @₹2000)"
   }
   ```

### B. Monthly Usage Tracking

1. **Track ePaper page uploads**
   ```typescript
   // When tenant uploads ePaper PDF
   // Auto-count pages and record in TenantUsageMonthly
   
   async function trackEpaperPageCount(tenantId, pageCount, issueDate) {
     const period = getMonthPeriod(issueDate);
     
     await prisma.tenantUsageMonthly.upsert({
       where: { tenantId_periodStart: { tenantId, periodStart: period.start } },
       update: {
         epaperPageCount: { increment: pageCount }
       },
       create: {
         tenantId,
         periodStart: period.start,
         periodEnd: period.end,
         epaperPageCount: pageCount
       }
     });
   }
   ```

### C. Monthly Billing (Auto-run on 1st of every month)

1. **Calculate charges**
   ```typescript
   async function generateMonthlyInvoice(tenantId, period) {
     // Get usage
     const usage = await prisma.tenantUsageMonthly.findUnique({
       where: { tenantId_periodStart: { tenantId, periodStart: period.start } }
     });
     
     // Get pricing
     const pricing = await prisma.tenantPricing.findFirst({
       where: { 
         tenantId, 
         service: 'EPAPER',
         isActive: true,
         effectiveFrom: { lte: period.start }
       }
     });
     
     // Calculate charges
     const pageCount = Math.max(usage.epaperPageCount, pricing.minEpaperPages);
     const chargeMinor = pageCount * pricing.pricePerPageMinor;
     
     // Create invoice
     const invoice = await prisma.billingInvoice.create({
       data: {
         tenantId,
         kind: 'SUBSCRIPTION',
         status: 'OPEN',
         periodStart: period.start,
         periodEnd: period.end,
         totalAmountMinor: chargeMinor,
         lineItems: {
           create: {
             component: 'EPAPER_PAGE',
             description: `ePaper pages (${pageCount} pages @ ₹${pricing.pricePerPageMinor/100})`,
             quantity: pageCount,
             unitAmountMinor: pricing.pricePerPageMinor,
             amountMinor: chargeMinor
           }
         }
       }
     });
     
     // Deduct from wallet
     await deductFromWallet(tenantId, chargeMinor, invoice.id);
   }
   ```

2. **Deduct from wallet**
   ```typescript
   async function deductFromWallet(tenantId, amountMinor, invoiceId) {
     const wallet = await prisma.tenantWallet.findUnique({ where: { tenantId } });
     
     if (wallet.balanceMinor < amountMinor) {
       // Insufficient balance → Mark invoice as PAST_DUE
       await prisma.billingInvoice.update({
         where: { id: invoiceId },
         data: { status: 'PAST_DUE' }
       });
       
       // Lock tenant access
       await lockTenantAccess(tenantId, 'Insufficient balance for monthly charges');
       return;
     }
     
     // Deduct balance
     const newBalance = wallet.balanceMinor - amountMinor;
     
     await prisma.$transaction([
       prisma.tenantWallet.update({
         where: { id: wallet.id },
         data: { balanceMinor: newBalance }
       }),
       prisma.walletTransaction.create({
         data: {
           walletId: wallet.id,
           type: 'DEBIT',
           amountMinor: -amountMinor,
           balanceAfterMinor: newBalance,
           description: `Monthly ePaper charges`,
           referenceType: 'INVOICE',
           referenceId: invoiceId
         }
       }),
       prisma.billingInvoice.update({
         where: { id: invoiceId },
         data: { status: 'PAID', paidAt: new Date() }
       })
     ]);
   }
   ```

### D. Access Control (Login Check)

```typescript
// Middleware: Check balance before allowing login
export async function checkTenantSubscriptionAccess(req, res, next) {
  const user = req.user;
  
  // Only apply to TENANT_ADMIN and REPORTER roles
  if (!['TENANT_ADMIN', 'REPORTER'].includes(user.role.name)) {
    return next();
  }
  
  // Get tenant from reporter profile
  const reporter = await prisma.reporter.findFirst({
    where: { userId: user.id },
    include: { tenant: { include: { wallet: true, pricing: true } } }
  });
  
  if (!reporter?.tenant) return next();
  
  const tenant = reporter.tenant;
  
  // Check if tenant is locked
  if (tenant.subscriptionLocked) {
    return res.status(403).json({
      error: 'Account locked',
      reason: tenant.lockedReason,
      message: 'Please contact administrator to recharge your account balance.'
    });
  }
  
  // Check minimum balance requirement (1 month charge)
  const pricing = tenant.pricing.find(p => p.service === 'EPAPER' && p.isActive);
  if (pricing) {
    const monthlyCharge = pricing.minEpaperPages * pricing.pricePerPageMinor;
    const wallet = tenant.wallet;
    
    if (wallet.balanceMinor < monthlyCharge) {
      // Lock access
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionLocked: true,
          lockedReason: `Insufficient balance. Minimum ₹${monthlyCharge/100} required.`,
          lockedAt: new Date()
        }
      });
      
      return res.status(402).json({
        error: 'Payment required',
        minimumBalance: monthlyCharge,
        currentBalance: wallet.balanceMinor,
        message: 'Your account balance is below the minimum required amount. Please top up to continue.'
      });
    }
  }
  
  next();
}
```

### E. Bulk Payment Discounts

```typescript
async function calculateBulkDiscount(tenantId, months) {
  const pricing = await prisma.tenantPricing.findFirst({
    where: { tenantId, service: 'EPAPER', isActive: true }
  });
  
  const monthlyCharge = pricing.minEpaperPages * pricing.pricePerPageMinor;
  let total = monthlyCharge * months;
  
  // Apply discount
  if (months >= 12) {
    const discount = total * (pricing.discount12MonthPercent / 100);
    total -= discount;
  } else if (months >= 6) {
    const discount = total * (pricing.discount6MonthPercent / 100);
    total -= discount;
  }
  
  return {
    monthlyCharge,
    months,
    subtotal: monthlyCharge * months,
    discount: (monthlyCharge * months) - total,
    total
  };
}

// API Example
POST /api/v1/admin/tenants/{tenantId}/wallet/topup-bulk
{
  "months": 12,  // Pay for 12 months
  "razorpayOrderId": "order_xyz"
}
```

---

## API Endpoints

### Super Admin APIs

#### 1. Configure Tenant Pricing
```
POST   /api/v1/admin/tenants/{tenantId}/pricing
GET    /api/v1/admin/tenants/{tenantId}/pricing
PUT    /api/v1/admin/tenants/{tenantId}/pricing/{pricingId}
DELETE /api/v1/admin/tenants/{tenantId}/pricing/{pricingId}
```

#### 2. Wallet Management
```
GET    /api/v1/admin/tenants/{tenantId}/wallet
POST   /api/v1/admin/tenants/{tenantId}/wallet/topup
POST   /api/v1/admin/tenants/{tenantId}/wallet/adjust
GET    /api/v1/admin/tenants/{tenantId}/wallet/transactions
```

#### 3. Access Control
```
POST   /api/v1/admin/tenants/{tenantId}/lock
POST   /api/v1/admin/tenants/{tenantId}/unlock
```

#### 4. Usage & Billing
```
GET    /api/v1/admin/tenants/{tenantId}/usage/monthly
POST   /api/v1/admin/billing/generate-monthly-invoices  // Cron job
```

### Tenant Admin APIs (Self-Service)

```
GET    /api/v1/tenant/wallet/balance
GET    /api/v1/tenant/wallet/transactions
GET    /api/v1/tenant/usage/current-month
GET    /api/v1/tenant/invoices
POST   /api/v1/tenant/wallet/topup-request  // Generate Razorpay order
```

---

## Cron Jobs

### 1. Monthly Invoice Generation
```typescript
// Run on 1st of every month at 00:00 IST
cron.schedule('0 0 1 * *', async () => {
  const previousMonth = getPreviousMonthPeriod();
  const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
  
  for (const tenant of tenants) {
    try {
      await generateMonthlyInvoice(tenant.id, previousMonth);
    } catch (error) {
      console.error(`Failed to generate invoice for tenant ${tenant.id}:`, error);
    }
  }
});
```

### 2. Daily Balance Check
```typescript
// Run daily at 08:00 IST to warn tenants
cron.schedule('0 8 * * *', async () => {
  const tenants = await prisma.tenant.findMany({
    where: { subscriptionLocked: false },
    include: { wallet: true, pricing: true }
  });
  
  for (const tenant of tenants) {
    const pricing = tenant.pricing.find(p => p.service === 'EPAPER' && p.isActive);
    if (!pricing) continue;
    
    const monthlyCharge = pricing.minEpaperPages * pricing.pricePerPageMinor;
    const warningThreshold = monthlyCharge * 1.5; // 1.5 months
    
    if (tenant.wallet.balanceMinor < warningThreshold) {
      // Send notification to tenant admin
      await sendLowBalanceNotification(tenant, monthlyCharge, tenant.wallet.balanceMinor);
    }
  }
});
```

---

## Example Scenarios

### Scenario 1: New Tenant Onboarding
1. Super admin creates tenant
2. Super admin sets pricing: 8 pages minimum @ ₹2000/page = ₹16,000/month
3. Tenant needs 3-month advance = ₹48,000
4. Super admin adds ₹48,000 to wallet
5. Tenant can now upload ePaper and use the system

### Scenario 2: Monthly Billing
- **Month 1**: Tenant uploads 10 pages → Charged ₹20,000 → Balance: ₹48,000 - ₹20,000 = ₹28,000
- **Month 2**: Tenant uploads 6 pages → Charged min 8 pages = ₹16,000 → Balance: ₹12,000
- **Month 3**: Monthly charge ₹16,000 but balance ₹12,000 → Insufficient → Account locked

### Scenario 3: Bulk Payment with Discount
- Tenant pays for 12 months at once
- Base: ₹16,000/month × 12 = ₹1,92,000
- Discount 15% = ₹28,800
- Final: ₹1,63,200
- Tenant saves ₹28,800

---

## Migration Plan

1. Create new tables (TenantWallet, WalletTransaction, TenantPricing, TenantUsageMonthly)
2. Add new enum values to BillingComponent
3. Backfill existing tenants:
   - Create default pricing
   - Create wallet with zero balance
   - Super admin manually adds initial balance
4. Deploy new APIs + middleware
5. Enable cron jobs

---

## Summary

✅ **Simple Implementation**: Extends existing billing schema minimally  
✅ **Industry Standard**: Follows Stripe/AWS wallet + usage-based model  
✅ **Flexible Pricing**: Tenant-specific rates + bulk discounts  
✅ **Access Control**: Automatic login block on insufficient balance  
✅ **Scalable**: Can add more services (Print, Custom) easily  
✅ **Transparent**: Full transaction history + invoice trail  

Idi production-ready design. Implementation ki migration file + API controllers create cheyyochu next step lo.
