# Wallet System with Flexible Amounts & Activation Dates
## (Small amounts + Balance tracking + Effective dates)

---

## Key Features (ముఖ్య లక్షణాలు)

✅ **Any Amount Add** - Small/large, any amount add cheyochu  
✅ **Balance Tracking** - Real-time balance, locked balance separate  
✅ **Activation Date** - Service aa date nundi activate avtadi  
✅ **Transaction History** - Full audit trail with timestamps  
✅ **Future-dated Pricing** - Advance lo pricing set chesi future date nundi apply cheyochu  

---

## 1. Flexible Wallet Top-ups (ఏ మొత్తం అయినా)

### Any Amount Add Cheyochu

```http
POST /api/v1/admin/tenants/{tenantId}/wallet/topup

# Small amount (₹500)
{
  "amountMinor": 50000,
  "description": "Test payment - ₹500"
}

# Medium amount (₹5,000)
{
  "amountMinor": 500000,
  "description": "Partial payment - ₹5,000"
}

# Large amount (₹50,000)
{
  "amountMinor": 5000000,
  "description": "Full advance - ₹50,000"
}

# Custom amount (₹12,345)
{
  "amountMinor": 1234500,
  "description": "Custom payment"
}
```

**No restrictions** - Minimum/maximum amount లేదు, complete flexibility!

---

## 2. Balance Tracking System (బ్యాలెన్స్ ట్రాకింగ్)

### Balance Types

```typescript
interface WalletBalance {
  balanceMinor: number;        // Total balance in wallet
  lockedBalanceMinor: number;  // Reserved for pending invoices
  availableBalanceMinor: number; // Available = Total - Locked
}
```

### Real-time Balance Check

```http
GET /api/v1/admin/tenants/{tenantId}/wallet

Response:
{
  "balance": {
    "total": 5000000,      // ₹50,000 total
    "locked": 1600000,     // ₹16,000 locked for invoice
    "available": 3400000,  // ₹34,000 available
    "currency": "INR"
  },
  "monthlyCharge": 1600000,
  "monthsRemaining": 2.13
}
```

### Transaction History (పూర్తి చరిత్ర)

```http
GET /api/v1/tenant/wallet/transactions?page=1&pageSize=20

Response:
{
  "transactions": [
    {
      "id": "tx_001",
      "type": "CREDIT",
      "amountMinor": 500000,        // +₹5,000
      "balanceAfterMinor": 5000000, // Balance after: ₹50,000
      "description": "Wallet top-up",
      "createdAt": "2025-01-15T10:00:00Z"
    },
    {
      "id": "tx_002",
      "type": "DEBIT",
      "amountMinor": -1600000,      // -₹16,000
      "balanceAfterMinor": 3400000, // Balance after: ₹34,000
      "description": "Monthly charges",
      "createdAt": "2025-02-01T00:00:00Z"
    }
  ]
}
```

---

## 3. Activation Date System (యాక్టివేషన్ తేదీ)

### Service Pricing with Effective Dates

```http
POST /api/v1/admin/tenants/{tenantId}/pricing

{
  "service": "EPAPER",
  "minEpaperPages": 8,
  "pricePerPageMinor": 200000,
  "discount6MonthPercent": 5.0,
  "discount12MonthPercent": 15.0,
  "effectiveFrom": "2025-03-01T00:00:00Z"  // ← Activate from 1st March
}
```

**How it works:**
- Before 1st March: Old pricing applies (if any)
- From 1st March onwards: New pricing applies automatically
- No manual intervention needed

### Multiple Pricing with Different Dates

```http
# Current pricing (active now)
POST /api/v1/admin/tenants/{tenantId}/pricing
{
  "service": "EPAPER",
  "pricePerPageMinor": 200000,  // ₹2,000/page
  "effectiveFrom": "2025-02-01T00:00:00Z"
}

# Future pricing (will activate on April 1st)
POST /api/v1/admin/tenants/{tenantId}/pricing
{
  "service": "EPAPER",
  "pricePerPageMinor": 180000,  // ₹1,800/page (discount)
  "effectiveFrom": "2025-04-01T00:00:00Z"
}
```

**System automatically:**
- Feb 2025: Uses ₹2,000/page
- March 2025: Uses ₹2,000/page
- April 2025 onwards: Switches to ₹1,800/page

---

## 4. Complete Example with Sample Data

### Scenario: CHR News Setup

#### Step 1: Create Pricing (Effective from 1st Feb 2025)

```http
POST /api/v1/admin/tenants/tenant_chr_001/pricing

{
  "service": "EPAPER",
  "minEpaperPages": 8,
  "pricePerPageMinor": 200000,
  "discount6MonthPercent": 5.0,
  "discount12MonthPercent": 15.0,
  "effectiveFrom": "2025-02-01T00:00:00Z"
}

Response:
{
  "pricing": {
    "id": "pricing_001",
    "service": "EPAPER",
    "minEpaperPages": 8,
    "pricePerPageMinor": 200000,
    "monthlyFeeMinor": null,
    "effectiveFrom": "2025-02-01T00:00:00.000Z",
    "effectiveUntil": null,
    "isActive": true
  }
}
```

#### Step 2: Multiple Small Top-ups

```http
# Top-up 1: ₹10,000
POST /api/v1/admin/tenants/tenant_chr_001/wallet/topup
{
  "amountMinor": 1000000,
  "description": "Initial payment - ₹10,000"
}

Response:
{
  "wallet": {
    "balanceMinor": 1000000,  // ₹10,000
    "availableBalanceMinor": 1000000
  },
  "transaction": {
    "type": "CREDIT",
    "amountMinor": 1000000,
    "balanceAfterMinor": 1000000
  }
}

# Top-up 2: ₹20,000
POST /api/v1/admin/tenants/tenant_chr_001/wallet/topup
{
  "amountMinor": 2000000,
  "description": "Second payment - ₹20,000"
}

Response:
{
  "wallet": {
    "balanceMinor": 3000000,  // ₹30,000 (10k + 20k)
    "availableBalanceMinor": 3000000
  }
}

# Top-up 3: ₹18,000
POST /api/v1/admin/tenants/tenant_chr_001/wallet/topup
{
  "amountMinor": 1800000,
  "description": "Final payment - ₹18,000"
}

Response:
{
  "wallet": {
    "balanceMinor": 4800000,  // ₹48,000 total (10k + 20k + 18k)
    "availableBalanceMinor": 4800000
  }
}
```

#### Step 3: Balance Status Check

```http
GET /api/v1/admin/tenants/tenant_chr_001/wallet

Response:
{
  "balance": {
    "total": 4800000,
    "locked": 0,
    "available": 4800000,
    "formatted": {
      "total": "₹48000.00",
      "available": "₹48000.00"
    }
  },
  "monthlyCharge": 1600000,      // 8 pages × ₹2000 = ₹16,000
  "monthsRemaining": 3.0,        // ₹48,000 / ₹16,000 = 3 months
  "hasSufficientBalance": true,
  "requiredMinimumBalance": 4800000  // 3 months × ₹16,000
}
```

#### Step 4: Upload ePaper (Auto Usage Tracking)

```
Feb 5: Upload 10 pages
Feb 10: Upload 12 pages
Feb 20: Upload 8 pages
```

```http
GET /api/v1/tenant/usage/current-month

Response:
{
  "period": {
    "start": "2025-02-01T00:00:00.000Z",
    "end": "2025-02-28T23:59:59.999Z",
    "month": "2025-02"
  },
  "usage": {
    "epaper": {
      "pageCount": 30,  // 10 + 12 + 8 = 30 pages
      "charge": 6000000,  // 30 pages × ₹2,000 = ₹60,000
      "chargeFormatted": "₹60000.00"
    }
  }
}
```

**But wait!** Monthly charge is min 8 pages, so actual charge = max(30, 8) × ₹2,000 = ₹60,000

#### Step 5: Month-end Auto Billing (1st March)

```
Cron job runs automatically at midnight
```

**Invoice Generated:**
```json
{
  "invoice": {
    "id": "inv_feb_2025_001",
    "tenantId": "tenant_chr_001",
    "kind": "SUBSCRIPTION",
    "status": "OPEN",
    "periodStart": "2025-02-01T00:00:00.000Z",
    "periodEnd": "2025-02-28T23:59:59.999Z",
    "totalAmountMinor": 6000000,  // ₹60,000
    "lineItems": [
      {
        "component": "EPAPER_PAGE",
        "description": "ePaper pages (30 pages @ ₹2000)",
        "quantity": 30,
        "unitAmountMinor": 200000,
        "amountMinor": 6000000
      }
    ]
  }
}
```

**Wallet Deduction:**
```json
{
  "transaction": {
    "type": "DEBIT",
    "amountMinor": -6000000,  // -₹60,000
    "balanceAfterMinor": -1200000,  // ₹48,000 - ₹60,000 = -₹12,000 (INSUFFICIENT!)
    "description": "Monthly ePaper charges"
  }
}
```

**❌ Insufficient Balance Detected!**

System automatically:
1. Marks invoice as `PAST_DUE`
2. Locks tenant access
3. Sends notification

#### Step 6: Additional Top-up to Clear Dues

```http
POST /api/v1/admin/tenants/tenant_chr_001/wallet/topup
{
  "amountMinor": 1500000,  // ₹15,000
  "description": "Clear dues + add balance"
}

Response:
{
  "wallet": {
    "balanceMinor": 3000000  // -₹12,000 + ₹15,000 = ₹3,000
  }
}
```

Invoice auto-paid, tenant unlocked!

---

## 5. Future Pricing Activation Example

### Setup: Price Reduction from April 2025

```http
# Current pricing (Feb-March 2025)
GET /api/v1/admin/tenants/tenant_chr_001/pricing

Response:
{
  "pricing": [
    {
      "id": "pricing_001",
      "service": "EPAPER",
      "pricePerPageMinor": 200000,  // ₹2,000/page
      "effectiveFrom": "2025-02-01T00:00:00.000Z",
      "effectiveUntil": null,
      "isActive": true
    }
  ]
}

# Add new pricing for April onwards (Discounted rate)
POST /api/v1/admin/tenants/tenant_chr_001/pricing
{
  "service": "EPAPER",
  "minEpaperPages": 8,
  "pricePerPageMinor": 180000,  // ₹1,800/page (10% discount)
  "effectiveFrom": "2025-04-01T00:00:00Z"
}

Response:
{
  "pricing": {
    "id": "pricing_002",
    "pricePerPageMinor": 180000,
    "effectiveFrom": "2025-04-01T00:00:00.000Z",
    "isActive": true
  }
}
```

**System automatically updates previous pricing:**
```json
{
  "pricing_001": {
    "effectiveFrom": "2025-02-01T00:00:00.000Z",
    "effectiveUntil": "2025-03-31T23:59:59.999Z",  // Auto-set
    "isActive": false  // Auto-deactivated
  },
  "pricing_002": {
    "effectiveFrom": "2025-04-01T00:00:00.000Z",
    "effectiveUntil": null,
    "isActive": true
  }
}
```

**Billing Impact:**
- February bill: 30 pages × ₹2,000 = ₹60,000
- March bill: 28 pages × ₹2,000 = ₹56,000
- **April bill: 25 pages × ₹1,800 = ₹45,000** ← New rate applied!

---

## 6. Advanced: Service Activation Scheduling

### Add News Website Service from 1st May

```http
POST /api/v1/admin/tenants/tenant_chr_001/pricing
{
  "service": "NEWS_WEBSITE",
  "monthlyFeeMinor": 300000,  // ₹3,000/month fixed
  "effectiveFrom": "2025-05-01T00:00:00Z"
}
```

**Result:**
- April: Only ePaper charges
- May onwards: ePaper + News Website charges
- Auto-activates on 1st May midnight

### Enable News Website Immediately

```http
# Update usage for current month
PUT /api/v1/admin/tenants/tenant_chr_001/usage/current
{
  "newsWebsiteActive": true
}

# This month's bill will include News Website charge
```

---

## 7. Complete Transaction Timeline (Real Example)

### CHR News - February 2025

```
Date         | Event                    | Amount      | Balance After
-------------|--------------------------|-------------|---------------
Feb 1        | Initial pricing set     | -           | -
Feb 1        | Top-up #1               | +₹10,000    | ₹10,000
Feb 3        | Top-up #2               | +₹20,000    | ₹30,000
Feb 5        | Upload 10 pages         | -           | ₹30,000
Feb 7        | Top-up #3               | +₹18,000    | ₹48,000
Feb 10       | Upload 12 pages         | -           | ₹48,000
Feb 20       | Upload 8 pages          | -           | ₹48,000
Mar 1 00:00  | Monthly billing         | -₹60,000    | -₹12,000 ❌
Mar 1 00:01  | Account locked          | -           | -₹12,000
Mar 1 09:00  | Top-up #4              | +₹15,000    | ₹3,000
Mar 1 09:01  | Account unlocked        | -           | ₹3,000
Mar 5        | Upload 8 pages          | -           | ₹3,000
Apr 1 00:00  | New pricing active      | -           | ₹3,000
Apr 1 00:01  | Monthly billing (8×₹1,800) | -₹14,400 | -₹11,400 ❌
```

---

## 8. API Summary - All Operations

### Balance Management
```bash
# Check balance
GET /api/v1/tenant/wallet/balance

# Add any amount
POST /api/v1/admin/tenants/{id}/wallet/topup
{ "amountMinor": 50000 }  # ₹500

# Transaction history
GET /api/v1/tenant/wallet/transactions?page=1
```

### Pricing with Dates
```bash
# Set pricing with activation date
POST /api/v1/admin/tenants/{id}/pricing
{
  "service": "EPAPER",
  "pricePerPageMinor": 200000,
  "effectiveFrom": "2025-03-01T00:00:00Z"
}

# View all pricing history
GET /api/v1/admin/tenants/{id}/pricing
```

### Usage Tracking
```bash
# Current month usage
GET /api/v1/tenant/usage/current-month

# Manual adjustment (if needed)
POST /api/v1/admin/tenants/{id}/wallet/adjust
{
  "amountMinor": -50000,  # Deduct ₹500
  "description": "Adjustment for error"
}
```

---

## Key Benefits (ముఖ్య ప్రయోజనాలు)

✅ **Flexibility** - Any amount add cheyochu (₹1 to unlimited)  
✅ **Accuracy** - Every paisa tracked with timestamp  
✅ **Future Planning** - Advance lo pricing set cheyochu  
✅ **Auto-activation** - Selected date nundi auto-apply  
✅ **Full History** - Every transaction recorded  
✅ **Real-time** - Balance instant update  

---

## Database Records (Sample)

### TenantWallet Table
```sql
id          | tenantId         | balanceMinor | lockedBalanceMinor | updatedAt
------------|------------------|--------------|--------------------|-----------
wallet_001  | tenant_chr_001   | 3000000      | 0                  | 2025-03-01
```

### WalletTransaction Table
```sql
id     | walletId   | type   | amountMinor | balanceAfterMinor | description        | createdAt
-------|------------|--------|-------------|-------------------|--------------------|----------
tx_001 | wallet_001 | CREDIT | 1000000     | 1000000          | Top-up ₹10,000     | 2025-02-01
tx_002 | wallet_001 | CREDIT | 2000000     | 3000000          | Top-up ₹20,000     | 2025-02-03
tx_003 | wallet_001 | CREDIT | 1800000     | 4800000          | Top-up ₹18,000     | 2025-02-07
tx_004 | wallet_001 | DEBIT  | -6000000    | -1200000         | Monthly charges    | 2025-03-01
tx_005 | wallet_001 | CREDIT | 1500000     | 300000           | Clear dues         | 2025-03-01
```

### TenantPricing Table
```sql
id          | tenantId       | service | pricePerPageMinor | effectiveFrom | effectiveUntil | isActive
------------|----------------|---------|-------------------|---------------|----------------|----------
pricing_001 | tenant_chr_001 | EPAPER  | 200000           | 2025-02-01    | 2025-03-31    | false
pricing_002 | tenant_chr_001 | EPAPER  | 180000           | 2025-04-01    | null          | true
```

---

## Summary (సారాంశం)

1. **Any Amount**: Small/large, emi amount ayina add cheyochu
2. **Balance Tracking**: Real-time balance + transaction history
3. **Activation Date**: Service aa specific date nundi activate
4. **Auto-switching**: Old pricing expires, new pricing activates automatically
5. **Complete Audit**: Every transaction with timestamp and description

System completely flexible and production-ready! 🚀
