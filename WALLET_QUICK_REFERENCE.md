# Wallet System - Quick Reference Card
## (Small Amounts + Balance Tracking + Activation Dates)

---

## 🎯 Key Capabilities

| Feature | Description | Example |
|---------|-------------|---------|
| **Flexible Top-ups** | Any amount add cheyochu | ₹50, ₹500, ₹5000, ₹50000 - all allowed |
| **Balance Tracking** | Real-time balance with history | Every transaction timestamp tho |
| **Activation Dates** | Future nundi pricing activate | Set today, apply from next month |
| **Auto-switching** | Old pricing auto-expire | Apr 1 ki new rate auto-apply |
| **Transaction Log** | Complete audit trail | Every paisa accounted |

---

## 💰 Add Money (Any Amount)

```http
POST /api/v1/admin/tenants/{tenantId}/wallet/topup

# ₹100
{ "amountMinor": 10000, "description": "Test payment" }

# ₹1,234.50
{ "amountMinor": 123450, "description": "Custom amount" }

# ₹50,000
{ "amountMinor": 5000000, "description": "Bulk payment" }
```

**No minimum/maximum limits!**

---

## 📊 Check Balance

```http
GET /api/v1/tenant/wallet/balance

Response:
{
  "balance": {
    "total": 4800000,        // ₹48,000
    "locked": 0,
    "available": 4800000     // ₹48,000 available
  },
  "monthlyCharge": 1600000,  // ₹16,000/month
  "monthsRemaining": 3.0
}
```

---

## 📜 Transaction History

```http
GET /api/v1/tenant/wallet/transactions?page=1

Response:
{
  "transactions": [
    {
      "type": "CREDIT",
      "amountMinor": 500000,       // +₹5,000
      "balanceAfterMinor": 500000, // Balance: ₹5,000
      "description": "Top-up",
      "createdAt": "2025-02-01T10:00:00Z"
    },
    {
      "type": "DEBIT",
      "amountMinor": -160000,      // -₹1,600
      "balanceAfterMinor": 340000, // Balance: ₹3,400
      "description": "Monthly charge",
      "createdAt": "2025-03-01T00:00:00Z"
    }
  ]
}
```

---

## 📅 Set Pricing with Activation Date

```http
POST /api/v1/admin/tenants/{tenantId}/pricing

{
  "service": "EPAPER",
  "pricePerPageMinor": 200000,
  "effectiveFrom": "2025-03-01T00:00:00Z"  ← Start from March 1st
}
```

**System automatically:**
- Before March 1: Old pricing (if any)
- From March 1 onwards: New pricing
- Old pricing auto-expires on Feb 28

---

## 🔮 Future Pricing Example

```http
# Current pricing (active now)
POST /api/v1/admin/tenants/{id}/pricing
{
  "pricePerPageMinor": 200000,  // ₹2,000
  "effectiveFrom": "2025-02-01"
}

# Future pricing (activates April 1)
POST /api/v1/admin/tenants/{id}/pricing
{
  "pricePerPageMinor": 180000,  // ₹1,800 (discount)
  "effectiveFrom": "2025-04-01"
}

Result:
- Feb & Mar: Bills at ₹2,000/page
- Apr onwards: Bills at ₹1,800/page (auto-switch)
```

---

## 🕐 Timeline Example

```
┌─────────────────────────────────────────────────────────┐
│ Feb 1  │ Set pricing (₹2000/page, effectiveFrom: Feb 1) │
│ Feb 1  │ Top-up ₹5,000   → Balance: ₹5,000              │
│ Feb 3  │ Top-up ₹3,500   → Balance: ₹8,500              │
│ Feb 5  │ Upload 10 pages (tracked)                       │
│ Feb 7  │ Top-up ₹32,000  → Balance: ₹40,500             │
│ Feb 10 │ Upload 8 pages  (total: 18 pages)              │
├─────────────────────────────────────────────────────────┤
│ Mar 1  │ Auto billing: 18 × ₹2000 = ₹36,000            │
│ Mar 1  │ Deduct from wallet → Balance: ₹4,500           │
│ Mar 5  │ Upload 12 pages                                 │
├─────────────────────────────────────────────────────────┤
│ Apr 1  │ NEW PRICING ACTIVATES (₹1800/page) ✨          │
│ Apr 1  │ March bill: 12 × ₹2000 = ₹24,000 (old rate)   │
│ Apr 1  │ Balance: ₹4,500 - ₹24,000 = INSUFFICIENT ❌    │
│ Apr 1  │ Account LOCKED                                  │
│ Apr 2  │ Top-up ₹25,000 → Unlocked ✅                   │
│ Apr 5  │ Upload 15 pages (charged at NEW ₹1800 rate)   │
├─────────────────────────────────────────────────────────┤
│ May 1  │ April bill: 15 × ₹1800 = ₹27,000 (new rate) ✅│
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Balance Types

```
┌──────────────────────────────────────┐
│ TenantWallet                         │
├──────────────────────────────────────┤
│ balanceMinor:       5000000          │  ← Total: ₹50,000
│ lockedBalanceMinor: 1600000          │  ← Locked: ₹16,000 (for pending invoice)
│ availableBalance:   3400000          │  ← Available: ₹34,000 (can use)
└──────────────────────────────────────┘

Available = Total - Locked
```

---

## 📋 Database Tables

### TenantWallet
```sql
id | tenantId | balanceMinor | lockedBalanceMinor | currency | updatedAt
---|----------|--------------|--------------------|-----------|-----------
w1 | t_001    | 5000000      | 0                  | INR      | 2025-02-15
```

### WalletTransaction (Every Change Recorded)
```sql
id  | type   | amountMinor | balanceAfterMinor | description  | createdAt
----|--------|-------------|-------------------|--------------|------------
tx1 | CREDIT | 500000      | 500000           | Top-up       | 2025-02-01
tx2 | CREDIT | 350000      | 850000           | Top-up       | 2025-02-03
tx3 | DEBIT  | -160000     | 690000           | Monthly bill | 2025-03-01
```

### TenantPricing (Timeline Management)
```sql
id  | service | pricePerPageMinor | effectiveFrom | effectiveUntil | isActive
----|---------|-------------------|---------------|----------------|----------
p1  | EPAPER  | 200000           | 2025-02-01    | 2025-03-31    | false ⏹️
p2  | EPAPER  | 180000           | 2025-04-01    | null          | true  ✅
```

---

## ✅ What Gets Tracked?

| Event | Tracked in Database | Timestamp | Balance Snapshot |
|-------|---------------------|-----------|------------------|
| Top-up ₹5,000 | WalletTransaction | Yes | Yes |
| Top-up ₹3,500 | WalletTransaction | Yes | Yes |
| Upload 10 pages | TenantUsageMonthly | Yes | No |
| Monthly billing | BillingInvoice + WalletTransaction | Yes | Yes |
| Balance deduction | WalletTransaction | Yes | Yes |
| Pricing change | TenantPricing | Yes (effectiveFrom) | No |

**Every rupee tracked!** 💯

---

## 🚀 Quick Commands

```bash
# Add small amount
curl -X POST http://localhost:3000/api/v1/admin/tenants/{id}/wallet/topup \
  -d '{"amountMinor": 50000, "description": "₹500"}'

# Check balance
curl http://localhost:3000/api/v1/tenant/wallet/balance

# View history
curl http://localhost:3000/api/v1/tenant/wallet/transactions?page=1

# Set future pricing
curl -X POST http://localhost:3000/api/v1/admin/tenants/{id}/pricing \
  -d '{
    "service": "EPAPER",
    "pricePerPageMinor": 180000,
    "effectiveFrom": "2025-04-01T00:00:00Z"
  }'

# View all pricing (current + future)
curl http://localhost:3000/api/v1/admin/tenants/{id}/pricing
```

---

## 🎯 Key Benefits

✅ **Flexibility** → Add any amount (₹1 to unlimited)  
✅ **Accuracy** → Every paisa tracked with timestamp  
✅ **Automation** → Pricing auto-switches on date  
✅ **History** → Complete audit trail  
✅ **Real-time** → Balance updates instantly  
✅ **Future-proof** → Set prices months in advance  

---

## 📞 Common Questions

**Q: Can I add ₹50?**  
A: Yes! Any amount allowed.

**Q: Will old pricing stop automatically?**  
A: Yes! When new pricing's effectiveFrom date arrives, old one auto-expires.

**Q: Can I see all transactions?**  
A: Yes! Full history with timestamps and balance snapshots.

**Q: What if balance becomes negative?**  
A: Account locks immediately. Add balance to unlock.

**Q: Can I set pricing for next year?**  
A: Yes! Set effectiveFrom to any future date. System will activate automatically.

---

**Documentation:** [WALLET_FLEXIBLE_AMOUNTS_GUIDE.md](./WALLET_FLEXIBLE_AMOUNTS_GUIDE.md)  
**API Docs:** http://localhost:3000/api/v1/docs  

---

**System Ready!** 🚀
