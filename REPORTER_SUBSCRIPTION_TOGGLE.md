# Reporter Subscription Toggle Behavior

## Issue
Admin enables reporter subscription, reporter pays, then admin disables subscription later.
**Question:** Does ID card generation still require monthly payment when subscription is OFF?

## Answer: ✅ NO - Already Working Correctly

When `subscriptionActive = false`, **monthly payment check is completely skipped**.

## How It Works

### ID Card Generation Logic
```typescript
// Step 1: Check onboarding payment (one-time)
if (onboarding payment exists AND is PAID) {
  ✅ Skip idCardCharge check
} else if (idCardCharge > 0) {
  ❌ Require onboarding payment
}

// Step 2: Check monthly subscription (recurring)
if (subscriptionActive === true) {
  if (current month payment is PAID) {
    ✅ Allow ID card generation
  } else {
    ❌ Require current month payment
  }
} else {
  ✅ Skip monthly payment check completely
}
```

### Test Results
Ran test on 5 reporters with `subscriptionActive = false`:
- All 5 passed ID card generation checks ✅
- Monthly payment check was completely skipped ✅
- No payment required when subscription is OFF ✅

## Scenarios

### Scenario 1: Reporter with subscription ON
```json
{
  "idCardCharge": 0,
  "subscriptionActive": true,
  "monthlySubscriptionAmount": 1000
}
```
**Result:** ⚠️ Requires current month payment to be PAID

### Scenario 2: Admin turns subscription OFF
```json
{
  "idCardCharge": 0,
  "subscriptionActive": false,  // ← Changed to false
  "monthlySubscriptionAmount": 1000
}
```
**Result:** ✅ ID card generation works immediately (no payment check)

### Scenario 3: Admin turns subscription back ON
```json
{
  "idCardCharge": 0,
  "subscriptionActive": true,  // ← Changed back to true
  "monthlySubscriptionAmount": 1000
}
```
**Result:** ⚠️ Requires current month payment again

## Code Locations

### ID Card Generation Endpoints
1. **Tenant Admin Endpoint:** [tenantReporters.routes.ts](../src/api/reporters/tenantReporters.routes.ts#L2928-L2974)
2. **Legacy Endpoint:** [reporters.routes.ts](../src/api/reporters/reporters.routes.ts#L361-L403)
3. **Reporter Self-Service:** [reporters.me.idcard.routes.ts](../src/api/reporters/reporters.me.idcard.routes.ts#L98-L135)

### Payment Status Display
- **Reporter Listing:** [tenantReporters.routes.ts](../src/api/reporters/tenantReporters.routes.ts#L306-L325)

## Testing

### Check any reporter's payment logic
```bash
npx ts-node scripts/test_subscription_toggle.ts
```

### Verify specific reporter
```bash
npx ts-node scripts/check_reporter_payments.ts <reporterId>
```

## Summary

✅ **Current Behavior:** When admin toggles subscription OFF, monthly payment check is completely disabled.  
✅ **No changes needed:** Logic is already working correctly.  
✅ **Tested:** 5 reporters with subscription OFF all pass ID card generation.

**Note:** If you're seeing payment errors when subscription is OFF, verify:
1. Reporter's `subscriptionActive` field in database
2. Frontend might be showing stale data (refresh token/session)
3. Check actual reporter ID being used in the request
