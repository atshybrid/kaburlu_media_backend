# Tenant Subscription APIs - Swagger Documentation ✅

## Updated: February 12, 2026

All wallet and subscription APIs are now organized in Swagger under a new **"Tenant Subscription"** section.

---

## 📚 New Swagger Tags

The APIs are organized into **4 sub-sections**:

### 1. **Tenant Subscription - Wallet Management**
*Admin wallet operations*

**Endpoints:**
- `GET /api/v1/admin/tenants/{tenantId}/wallet` - Get wallet balance
- `POST /api/v1/admin/tenants/{tenantId}/wallet/topup` - Top-up wallet (any amount)
- `POST /api/v1/admin/tenants/{tenantId}/wallet/topup-bulk` - Bulk payment with discount (6/12 months)
- `POST /api/v1/admin/tenants/{tenantId}/wallet/calculate-bulk` - Calculate bulk discount (preview)
- `POST /api/v1/admin/tenants/{tenantId}/wallet/adjust` - Adjust balance (super admin only)
- `GET /api/v1/admin/tenants/{tenantId}/wallet/transactions` - Transaction history

**Features:**
- Top-up any amount (₹50 to unlimited)
- Bulk payments with 5% (6-month) and 15% (12-month) discounts
- Manual balance adjustments with audit trail
- Complete transaction history with timestamps and balance snapshots

---

### 2. **Tenant Subscription - Pricing Configuration**
*Admin pricing setup and service management*

**Endpoints:**
- `GET /api/v1/admin/tenants/{tenantId}/pricing` - Get pricing configuration
- `POST /api/v1/admin/tenants/{tenantId}/pricing` - Set tenant pricing
- `PUT /api/v1/admin/tenants/{tenantId}/pricing/{pricingId}` - Update pricing
- `DELETE /api/v1/admin/tenants/{tenantId}/pricing/{pricingId}` - Delete pricing
- `GET /api/v1/admin/tenants/{tenantId}/services` - Get active services
- `POST /api/v1/admin/tenants/{tenantId}/services/{service}/toggle` - Activate/deactivate service

**Features:**
- Tenant-specific rates (pricePerPageMinor)
- Minimum page requirements (minEpaperPages)
- Bulk discounts (6-month: 5%, 12-month: 15%)
- **Activation dates** (effectiveFrom/effectiveUntil)
- Future pricing scheduling
- Automatic old pricing expiration
- Multi-service support (EPAPER, NEWS_WEBSITE, PRINT_SERVICE, CUSTOM_SERVICE)

**Sample Request (Set Pricing):**
```json
{
  "service": "EPAPER",
  "minEpaperPages": 8,
  "pricePerPageMinor": 200000,
  "discount6MonthPercent": 5.0,
  "discount12MonthPercent": 15.0,
  "effectiveFrom": "2026-03-01T00:00:00Z"
}
```

---

### 3. **Tenant Subscription - Billing & Usage**
*Admin billing operations and usage tracking*

**Endpoints:**
- `GET /api/v1/admin/tenants/{tenantId}/usage/current` - Current month usage
- `POST /api/v1/admin/tenants/{tenantId}/lock` - Lock tenant access (insufficient balance)
- `POST /api/v1/admin/tenants/{tenantId}/unlock` - Unlock tenant access

**Features:**
- Real-time usage tracking (pages uploaded this month)
- Monthly charge calculation
- Projected billing amount
- Account lock/unlock with reason
- Auto-lock on insufficient balance

**Sample Response (Current Usage):**
```json
{
  "year": 2026,
  "month": 2,
  "services": [
    {
      "service": "EPAPER",
      "quantity": 18,
      "totalAmountMinor": 360000,
      "totalAmount": 3600.00
    }
  ],
  "totalChargeMinor": 360000,
  "totalCharge": 3600.00
}
```

---

### 4. **Tenant Subscription - Self-Service**
*Tenant self-service operations*

**Endpoints:**
- `GET /api/v1/tenant/wallet/balance` - Get my wallet balance
- `GET /api/v1/tenant/wallet/transactions` - My transaction history
- `GET /api/v1/tenant/usage/current-month` - My current month usage
- `GET /api/v1/tenant/invoices` - My invoices
- `POST /api/v1/tenant/wallet/topup-request` - Request top-up

**Features:**
- View current balance and available balance
- Check months remaining
- View transaction history with filters
- See current month usage and projected charges
- Access past invoices (PAID, PAST_DUE, OPEN)
- Request top-up from admin

**Sample Response (My Balance):**
```json
{
  "balance": {
    "total": 4800000,
    "locked": 0,
    "available": 4800000,
    "totalRupees": 48000.00,
    "availableRupees": 48000.00
  },
  "monthlyCharge": 1600000,
  "monthlyChargeRupees": 16000.00,
  "monthsRemaining": 3.0,
  "isLocked": false
}
```

---

## 🎯 Swagger UI Access

**Development:**
- http://localhost:3001/api/v1/docs

**Production:**
- https://api.kaburlumedia.com/api/v1/docs
- https://app.kaburlumedia.com/api/v1/docs

---

## 📊 Swagger Tags Organization

In Swagger UI, you'll now see a clean structure:

```
└── Tenant Subscription
    ├── Tenant Subscription - Wallet Management
    │   ├── GET  /admin/tenants/{id}/wallet
    │   ├── POST /admin/tenants/{id}/wallet/topup
    │   ├── POST /admin/tenants/{id}/wallet/topup-bulk
    │   ├── POST /admin/tenants/{id}/wallet/calculate-bulk
    │   ├── POST /admin/tenants/{id}/wallet/adjust
    │   └── GET  /admin/tenants/{id}/wallet/transactions
    │
    ├── Tenant Subscription - Pricing Configuration
    │   ├── GET    /admin/tenants/{id}/pricing
    │   ├── POST   /admin/tenants/{id}/pricing
    │   ├── PUT    /admin/tenants/{id}/pricing/{pricingId}
    │   ├── DELETE /admin/tenants/{id}/pricing/{pricingId}
    │   ├── GET    /admin/tenants/{id}/services
    │   └── POST   /admin/tenants/{id}/services/{service}/toggle
    │
    ├── Tenant Subscription - Billing & Usage
    │   ├── GET  /admin/tenants/{id}/usage/current
    │   ├── POST /admin/tenants/{id}/lock
    │   └── POST /admin/tenants/{id}/unlock
    │
    └── Tenant Subscription - Self-Service
        ├── GET  /tenant/wallet/balance
        ├── GET  /tenant/wallet/transactions
        ├── GET  /tenant/usage/current-month
        ├── GET  /tenant/invoices
        └── POST /tenant/wallet/topup-request
```

---

## 🔑 Authentication

All endpoints require JWT authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://api.kaburlumedia.com/api/v1/admin/tenants/{id}/wallet
```

**Admin endpoints** require:
- `SUPER_ADMIN` or `DESK_EDITOR` role
- Some operations (adjust, lock/unlock) require `SUPER_ADMIN` only

**Self-service endpoints** require:
- Valid tenant user authentication
- Auto-resolved tenant from JWT token

---

## 📝 Complete API Examples

### Example 1: Set Future Pricing

**Scenario:** New pricing for April 2026 (10% discount per page)

```bash
curl -X POST https://api.kaburlumedia.com/api/v1/admin/tenants/tenant_123/pricing \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "EPAPER",
    "minEpaperPages": 8,
    "pricePerPageMinor": 180000,
    "effectiveFrom": "2026-04-01T00:00:00Z",
    "discount6MonthPercent": 5.0,
    "discount12MonthPercent": 15.0
  }'
```

**Result:**
- Old pricing (₹2000/page) active until March 31, 2026
- New pricing (₹1800/page) activates April 1, 2026
- System auto-switches at midnight

---

### Example 2: Small Amount Top-Up

**Scenario:** Tenant needs ₹5,000 emergency top-up

```bash
curl -X POST https://api.kaburlumedia.com/api/v1/admin/tenants/tenant_123/wallet/topup \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "amountMinor": 500000,
    "description": "Emergency top-up ₹5,000"
  }'
```

**Result:**
- Wallet balance increases by ₹5,000
- Transaction logged with timestamp
- Balance snapshot saved
- Tenant can check immediately via self-service API

---

### Example 3: Bulk Payment with Discount

**Scenario:** 12-month advance payment with 15% discount

```bash
curl -X POST https://api.kaburlumedia.com/api/v1/admin/tenants/tenant_123/wallet/topup-bulk \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "months": 12
  }'
```

**Calculation:**
- Monthly charge: ₹16,000 (8 pages × ₹2,000)
- 12-month total: ₹192,000
- 15% discount: -₹28,800
- **Final amount: ₹163,200**

---

### Example 4: Tenant Self-Check Balance

**Scenario:** Tenant checks their own balance

```bash
curl https://api.kaburlumedia.com/api/v1/tenant/wallet/balance \
  -H "Authorization: Bearer TENANT_JWT"
```

**Response:**
```json
{
  "balance": {
    "total": 4800000,
    "locked": 0,
    "available": 4800000,
    "totalRupees": 48000.00
  },
  "monthlyCharge": 1600000,
  "monthlyChargeRupees": 16000.00,
  "monthsRemaining": 3.0,
  "isLocked": false
}
```

---

## 🔧 Files Updated

1. **src/lib/swagger.ts** - Added 4 new tags
2. **src/api/wallet/wallet.routes.ts** - Updated all Swagger annotations
3. **src/api/wallet/tenant.routes.ts** - Updated all Swagger annotations
4. **src/api/wallet/pricing.routes.ts** - Updated all Swagger annotations

---

## ✅ Verification

After server restart:
1. Open Swagger UI: http://localhost:3001/api/v1/docs
2. Look for "Tenant Subscription" sections
3. Expand each section to see endpoints
4. Test APIs with "Try it out" button

---

**Last Updated:** February 12, 2026  
**Deployed To:** Development + Production  
**Status:** ✅ Live  
