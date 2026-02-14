# Tenant Subscription & Wallet System - Usage Guide (తెలుగు + English)

## Overview (సారాంశం)

ePaper pages based subscription system tho wallet balance management. Industry-standard approach (Stripe/AWS model).

**Key Features:**
- ✅ Per-page billing (minimum 8 pages)
- ✅ 3-month advance payment requirement
- ✅ Automatic login blocking when balance < 1 month
- ✅ Bulk discounts (6/12 months)
- ✅ Wallet transaction history
- ✅ Auto-track ePaper page uploads
- ✅ Monthly auto-billing

---

## Quick Start (త్వరిత మార్గదర్శి)

### 1. Migration Run చెయ్యండి

```bash
# Database schema update
npm run prisma:generate
npm run prisma:migrate:dev

# Production lo
npm run prisma:migrate:deploy
```

### 2. Existing Tenants ki Wallet + Pricing Create చెయ్యండి

```bash
npm run backfill:wallets
```

**Output example:**
```
📌 Processing: CHR News (TG001)
   ✓ Wallet created (Balance: ₹0)
   ✓ Pricing configured:
     - Min pages: 8
     - Price per page: ₹2000
     - Monthly charge: ₹16000
     - Required advance (3 months): ₹48000
```

### 3. Tenant ki Initial Balance Add చెయ్యండి

**API Call:**
```http
POST http://localhost:3000/api/v1/admin/tenants/{tenantId}/wallet/topup
Authorization: Bearer {super_admin_token}

{
  "amountMinor": 4800000,
  "description": "Initial 3-month advance (8 pages @ ₹2000)"
}
```

**Response:**
```json
{
  "message": "Wallet topped up successfully",
  "wallet": {
    "balanceMinor": 4800000,  // ₹48,000
    "availableBalanceMinor": 4800000
  }
}
```

---

## Daily Usage (రోజువారీ వాడుక)

### Tenant Admin - Balance Check చెయ్యడం

```http
GET http://localhost:3000/api/v1/tenant/wallet/balance
Authorization: Bearer {tenant_admin_token}
```

**Response:**
```json
{
  "balance": {
    "total": 4800000,
    "available": 4800000,
    "formatted": {
      "total": "₹48000.00",
      "available": "₹48000.00"
    }
  },
  "monthlyCharge": 1600000,
  "monthsRemaining": 3.0,
  "hasSufficientBalance": true,
  "requiredMinimumBalance": 1600000,
  "warning": null
}
```

### Current Month Usage చూడటం

```http
GET http://localhost:3000/api/v1/tenant/usage/current-month
Authorization: Bearer {tenant_admin_token}
```

**Response:**
```json
{
  "period": {
    "month": "2025-01"
  },
  "usage": {
    "epaper": {
      "pageCount": 12,
      "chargeFormatted": "₹24000.00"
    }
  }
}
```

### Transaction History చూడటం

```http
GET http://localhost:3000/api/v1/tenant/wallet/transactions?page=1&pageSize=20
```

---

## Super Admin - Pricing Management

### 1. Tenant Pricing Set చెయ్యడం

```http
POST http://localhost:3000/api/v1/admin/tenants/{tenantId}/pricing

{
  "service": "EPAPER",
  "minEpaperPages": 8,
  "pricePerPageMinor": 200000,  // ₹2000 per page
  "discount6MonthPercent": 5.0,
  "discount12MonthPercent": 15.0
}
```

### 2. Wallet Top-up (Normal)

```http
POST http://localhost:3000/api/v1/admin/tenants/{tenantId}/wallet/topup

{
  "amountMinor": 1600000,  // ₹16,000
  "description": "Monthly top-up"
}
```

### 3. Bulk Payment with Discount

**Calculate first:**
```http
POST http://localhost:3000/api/v1/admin/tenants/{tenantId}/wallet/calculate-bulk

{
  "months": 12
}
```

**Response:**
```json
{
  "monthlyCharge": 1600000,
  "months": 12,
  "subtotal": 19200000,  // ₹192,000
  "discountPercent": 15.0,
  "discount": 2880000,    // ₹28,800 discount
  "total": 16320000      // ₹163,200 final
}
```

**Then top-up:**
```http
POST http://localhost:3000/api/v1/admin/tenants/{tenantId}/wallet/topup-bulk

{
  "months": 12
}
```

---

## Automatic Billing (స్వయంచాలక బిల్లింగ్)

### Monthly Invoice Generation (నెలవారీ)

**Cron:** 1st of every month at midnight

```bash
# Manual run test చెయ్యడానికి
npm run jobs:monthly-billing

# Production
npm run jobs:monthly-billing:prod
```

**What happens:**
1. Previous month usage calculate అవుతది
2. Invoice generate అవుతది
3. Wallet నుండి auto-deduct అవుతది
4. Balance insufficient అయితే tenant lock అవుతది

### Balance Check (రోజువారీ)

**Cron:** Every day 8 AM

```bash
npm run jobs:balance-check

# Production
npm run jobs:balance-check:prod
```

**Notifications:**
- 🟡 Low (1.5-2.5 months remaining)
- 🔴 Critical (< 1.5 months)
- ❌ Insufficient (< 1 month) → Login locked

---

## Access Control (లాగిన్ నియంత్రణ)

### Balance < 1 Month అయితే Login Block

**Error Response (402):**
```json
{
  "error": "Payment required",
  "code": "INSUFFICIENT_BALANCE",
  "minimumBalance": 1600000,
  "currentBalance": 800000,
  "monthlyCharge": 1600000,
  "monthsRemaining": 0.5,
  "message": "Your account balance is below the minimum required amount (1 month)..."
}
```

### Locked Tenant Access Try చేస్తే

**Error Response (403):**
```json
{
  "error": "Account locked",
  "code": "ACCOUNT_LOCKED",
  "reason": "Insufficient balance. Minimum ₹16000 required.",
  "message": "Your account has been locked. Please contact administrator..."
}
```

---

## Common Scenarios (సాధారణ పరిస్థితులు)

### Scenario 1: New Tenant Setup

```bash
# 1. Create pricing
POST /api/v1/admin/tenants/{tenantId}/pricing
{
  "service": "EPAPER",
  "minEpaperPages": 8,
  "pricePerPageMinor": 200000
}

# 2. Add 3-month advance
# 8 pages × ₹2000 × 3 months = ₹48,000
POST /api/v1/admin/tenants/{tenantId}/wallet/topup
{
  "amountMinor": 4800000,
  "description": "Initial 3-month advance"
}

# 3. Tenant can now login and upload ePaper
```

### Scenario 2: Monthly Billing Flow

```
Month 1: Uploaded 10 pages → Charged ₹20,000 → Balance: ₹28,000
Month 2: Uploaded 6 pages → Charged min 8 = ₹16,000 → Balance: ₹12,000
Month 3: Monthly charge ₹16,000 but balance ₹12,000 → LOGIN BLOCKED
```

### Scenario 3: Bulk Payment (12 months)

```bash
# Calculate discount
POST /api/v1/admin/tenants/{tenantId}/wallet/calculate-bulk
{ "months": 12 }

# Response:
# Subtotal: ₹192,000
# Discount (15%): -₹28,800
# Total: ₹163,200
# Savings: ₹28,800

# Pay with discount
POST /api/v1/admin/tenants/{tenantId}/wallet/topup-bulk
{ "months": 12 }
```

---

## API Reference (API సూచన)

### Admin APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/admin/tenants/{id}/wallet` | GET | Get wallet balance |
| `/api/v1/admin/tenants/{id}/wallet/topup` | POST | Top-up wallet |
| `/api/v1/admin/tenants/{id}/wallet/topup-bulk` | POST | Bulk payment |
| `/api/v1/admin/tenants/{id}/wallet/calculate-bulk` | POST | Calculate discount |
| `/api/v1/admin/tenants/{id}/wallet/transactions` | GET | Transaction history |
| `/api/v1/admin/tenants/{id}/usage/current` | GET | Current month usage |
| `/api/v1/admin/tenants/{id}/pricing` | GET/POST | Pricing config |
| `/api/v1/admin/tenants/{id}/lock` | POST | Lock access |
| `/api/v1/admin/tenants/{id}/unlock` | POST | Unlock access |

### Tenant Self-Service APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/tenant/wallet/balance` | GET | My wallet balance |
| `/api/v1/tenant/wallet/transactions` | GET | My transactions |
| `/api/v1/tenant/usage/current-month` | GET | My current usage |
| `/api/v1/tenant/invoices` | GET | My invoices |
| `/api/v1/tenant/wallet/topup-request` | POST | Request top-up |

### Swagger Documentation

```
http://localhost:3000/api/v1/docs
```

**Tags:**
- Tenant Wallet
- Tenant Billing
- Tenant Pricing
- Tenant Wallet (Self-Service)

---

## Troubleshooting (సమస్యల పరిష్కారం)

### Problem: Tenant login blocked

**Check:**
```bash
# 1. Check balance
GET /api/v1/admin/tenants/{tenantId}/wallet

# 2. Check if locked
GET /api/v1/admin/tenants/{tenantId}
# Look for: subscriptionLocked: true

# 3. Add balance
POST /api/v1/admin/tenants/{tenantId}/wallet/topup

# 4. Unlock
POST /api/v1/admin/tenants/{tenantId}/unlock
```

### Problem: ePaper pages not tracking

**Check:**
```bash
# 1. Check current month usage
GET /api/v1/admin/tenants/{tenantId}/usage/current

# 2. Manually track if needed (dev only)
# Auto-tracking happens in epaperPdfIssue.create
```

### Problem: No pricing configured

```bash
POST /api/v1/admin/tenants/{tenantId}/pricing
{
  "service": "EPAPER",
  "minEpaperPages": 8,
  "pricePerPageMinor": 200000
}
```

---

## System Monitoring (వ్యవస్థ పర్యవేక్షణ)

### Cron Jobs Status

```bash
# Monthly billing (1st of month)
crontab -e
0 0 1 * * cd /path/to/project && npm run jobs:monthly-billing:prod

# Daily balance check (8 AM)
0 8 * * * cd /path/to/project && npm run jobs:balance-check:prod
```

### Logs to Monitor

- ✅ Invoice generation success/failures
- ⚠️ Low balance warnings
- ❌ Locked tenants
- 💰 Large top-ups
- 📊 Monthly billing summary

---

## Summary (సంక్షిప్తం)

✅ **Setup:** Migration → Backfill → Pricing → Initial balance  
✅ **Daily:** Auto page tracking → Balance checks → Notifications  
✅ **Monthly:** Auto invoice → Auto deduct → Lock if insufficient  
✅ **Admin:** Full control via APIs  
✅ **Tenant:** Self-service balance/usage check  

**Contact:** Check [IMPLEMENTATION_SUMMARY_WALLET.md](./IMPLEMENTATION_SUMMARY_WALLET.md) for full technical details.
