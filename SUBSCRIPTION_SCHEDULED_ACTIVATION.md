# Subscription Scheduled Activation Feature

## Problem Statement (Telugu)
**మీరు చెప్పింది:** "naku oka issue vundi vundi subscription on chesteyimedetga effect avtundi but some time particue date nundi effect kavali adi ela handle cheyochu"

**Translation:** When enabling a subscription, it takes effect immediately. But sometimes you need it to take effect from a specific future date.

## Solution

### 1. SCHEDULED Status
Added a new `SCHEDULED` subscription status that allows creating subscriptions with future start dates.

**Available Subscription Statuses:**
- `SCHEDULED` - Subscription scheduled for future activation ✨ **NEW**
- `ACTIVE` - Currently active subscription
- `TRIALING` - Trial period subscription  
- `PAST_DUE` - Payment overdue
- `CANCELED` - Canceled subscription

### 2. Auto-Activation Logic
When creating/updating a subscription, the system automatically determines the status:
- **Start date in future** → Status = `SCHEDULED`
- **Start date is now/past** → Status = `ACTIVE` (or specified status)

### 3. Automatic Activation Cron
Scheduled subscriptions are automatically activated when their start date arrives via a background cron job.

## Usage

### Example 1: Schedule Subscription for Future Date

**API Request:**
```http
PUT /api/v1/tenants/{tenantId}/billing/subscription
Authorization: Bearer <SUPER_ADMIN_TOKEN>
Content-Type: application/json

{
  "planId": "cplan123",
  "currentPeriodStart": "2026-03-01T00:00:00.000Z",
  "currentPeriodEnd": "2026-04-01T00:00:00.000Z"
}
```

**Response:**
```json
{
  "id": "sub_xyz",
  "tenantId": "tenant_abc",
  "planId": "cplan123",
  "status": "SCHEDULED",
  "currentPeriodStart": "2026-03-01T00:00:00.000Z",
  "currentPeriodEnd": "2026-04-01T00:00:00.000Z",
  "cancelAtPeriodEnd": false,
  "plan": {
    "id": "cplan123",
    "name": "Premium Monthly",
    "currency": "INR"
  }
}
```

### Example 2: Immediate Activation

**API Request:**
```http
PUT /api/v1/tenants/{tenantId}/billing/subscription
Authorization: Bearer <SUPER_ADMIN_TOKEN>
Content-Type: application/json

{
  "planId": "cplan123"
  // No dates specified = starts immediately
}
```

**Response:**
```json
{
  "status": "ACTIVE",
  "currentPeriodStart": "2026-02-03T00:00:00.000Z",
  "currentPeriodEnd": "2026-03-03T00:00:00.000Z"
}
```

### Example 3: Explicitly Schedule Future Subscription

```http
PUT /api/v1/tenants/{tenantId}/billing/subscription

{
  "planId": "cplan123",
  "currentPeriodStart": "2026-04-01T00:00:00.000Z",
  "status": "SCHEDULED"
}
```

## Automatic Activation

### Background Cron Job

The system automatically activates scheduled subscriptions via:

**File:** `src/lib/activateScheduledSubscriptions.ts`

**What it does:**
1. Finds all subscriptions with `status = SCHEDULED` and `currentPeriodStart <= now`
2. Updates their status to `ACTIVE`
3. Logs activation events

**Schedule:** Run every 5-15 minutes via cron/scheduler

### Manual Trigger (Testing)

**API Endpoint:**
```http
POST /api/v1/billing/subscriptions/activate-scheduled
Authorization: Bearer <SUPER_ADMIN_TOKEN>
```

**Response:**
```json
{
  "activated": 3,
  "failed": 0
}
```

**Usage:** For testing or manual intervention when cron isn't running.

## Cron Setup

### Option 1: System Cron (Linux/macOS)

```bash
# Edit crontab
crontab -e

# Add this line (runs every 5 minutes)
*/5 * * * * cd /path/to/kaburlu_media_backend && npm run activate-subscriptions
```

**Add script to package.json:**
```json
{
  "scripts": {
    "activate-subscriptions": "ts-node src/lib/activateScheduledSubscriptions.ts"
  }
}
```

### Option 2: DigitalOcean/Render Background Worker

**Using PM2:**
```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    // ... main app
    {
      name: 'subscription-activator',
      script: 'node',
      args: '-r ts-node/register src/lib/activateScheduledSubscriptions.ts',
      cron_restart: '*/5 * * * *', // Every 5 minutes
      autorestart: false,
    },
  ],
};
```

### Option 3: API Polling (Simple)

Call the manual trigger endpoint from a monitoring service (UptimeRobot, Cronitor):

```bash
# Every 10 minutes
curl -X POST https://api.kaburlumedia.com/api/v1/billing/subscriptions/activate-scheduled \
  -H "Authorization: Bearer <TOKEN>"
```

## Implementation Details

### Database Schema

**Migration:** `20260203000000_add_scheduled_subscription_status`

```sql
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
```

**Model:**
```prisma
model TenantSubscription {
  status             SubscriptionStatus  @default(ACTIVE)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  // ... other fields
}

enum SubscriptionStatus {
  SCHEDULED   // New status
  ACTIVE
  TRIALING
  PAST_DUE
  CANCELED
}
```

### Code Changes

**Files Modified:**
1. `prisma/schema.prisma` - Added SCHEDULED enum value
2. `src/api/billing/billing.routes.ts` - Auto-status logic + manual trigger endpoint
3. `src/lib/activateScheduledSubscriptions.ts` - Cron job implementation

**Key Logic:**
```typescript
const start = parseIsoDate(currentPeriodStart) || new Date();
const now = new Date();

// Auto-determine status based on start date
const autoStatus = start.getTime() > now.getTime() 
  ? 'SCHEDULED' 
  : statusNorm;
```

## Testing

### 1. Create Scheduled Subscription

```bash
curl -X PUT http://localhost:3001/api/v1/tenants/{tenantId}/billing/subscription \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "cplan_monthly",
    "currentPeriodStart": "2026-03-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-04-01T00:00:00.000Z"
  }'
```

**Expected:** `status: "SCHEDULED"`

### 2. Verify Subscription is Not Active

```bash
curl http://localhost:3001/api/v1/tenants/{tenantId}/billing/subscription \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected:** Returns `null` (SCHEDULED subscriptions are not considered "active")

### 3. Manually Trigger Activation

```bash
# Set start date to past
curl -X PUT http://localhost:3001/api/v1/tenants/{tenantId}/billing/subscription \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "cplan_monthly",
    "currentPeriodStart": "2026-02-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-03-01T00:00:00.000Z",
    "status": "SCHEDULED"
  }'

# Trigger activation
curl -X POST http://localhost:3001/api/v1/billing/subscriptions/activate-scheduled \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>"
```

**Expected:**
```json
{
  "activated": 1,
  "failed": 0
}
```

### 4. Verify Activation

```bash
curl http://localhost:3001/api/v1/tenants/{tenantId}/billing/subscription \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected:** `status: "ACTIVE"`

## Benefits

✅ **Flexible Scheduling:** Create subscriptions weeks/months in advance  
✅ **Smooth Transitions:** Plan upgrades/downgrades without disruption  
✅ **Billing Alignment:** Start subscriptions on specific dates (e.g., 1st of month)  
✅ **Marketing Campaigns:** Schedule subscription activations for promotional events  
✅ **Automatic Activation:** Zero manual intervention once scheduled  

## Common Use Cases

### 1. New Tenant Onboarding
```
Day 1: Create tenant, setup domain
Day 5: Subscription scheduled to start
Day 5: Auto-activated → billing begins
```

### 2. Plan Upgrade Scheduling
```
Current: Basic plan expires Feb 28
Action: Schedule Premium plan for Mar 1
Mar 1: Auto-activated seamlessly
```

### 3. Seasonal Campaigns
```
Campaign: Free trial Nov 1-30
Setup: Schedule ACTIVE subscription for Dec 1
Dec 1: Auto-convert to paid subscription
```

## Monitoring

### Check Scheduled Subscriptions

**SQL Query:**
```sql
SELECT 
  ts.id,
  t.name AS tenant_name,
  bp.name AS plan_name,
  ts.status,
  ts."currentPeriodStart",
  ts."currentPeriodEnd"
FROM "TenantSubscription" ts
JOIN "Tenant" t ON t.id = ts."tenantId"
JOIN "BillingPlan" bp ON bp.id = ts."planId"
WHERE ts.status = 'SCHEDULED'
ORDER BY ts."currentPeriodStart" ASC;
```

### Logs to Monitor

```
[SubscriptionActivator] Checking for scheduled subscriptions to activate...
[SubscriptionActivator] Found 3 subscription(s) to activate
[SubscriptionActivator] ✓ Activated subscription sub_xyz for tenant Kaburlu Media
[SubscriptionActivator] Complete. Activated: 3, Failed: 0
```

## Security

**Authorization:** Only `SUPER_ADMIN` can:
- Create/update subscriptions
- Manually trigger activation

**Tenant Admins:** Can view their subscription status but cannot modify scheduled dates.

## Troubleshooting

### Subscription Not Auto-Activating

**Possible Causes:**
1. Cron job not running → Check PM2/cron logs
2. Start date in future → Verify `currentPeriodStart`
3. Manual trigger needed → Call `/activate-scheduled` endpoint

### Activation Failed

**Check Logs:**
```bash
pm2 logs subscription-activator
# or
cat /var/log/subscription-activator.log
```

**Common Issues:**
- Database connection lost
- Invalid subscription state
- Permission errors

## Production Deployment

### 1. Apply Migration
```bash
npx prisma migrate deploy
```

### 2. Setup Cron (PM2)
```bash
pm2 start ecosystem.config.cjs --only subscription-activator
pm2 save
```

### 3. Test Activation
```bash
# Create test scheduled subscription
# Manually trigger activation
# Verify status changed to ACTIVE
```

### 4. Monitor Logs
```bash
pm2 logs subscription-activator --lines 100
```

## Related Documentation

- [Billing API](src/api/billing/billing.routes.ts) - Subscription management endpoints
- [Prisma Schema](prisma/schema.prisma) - Database models
- [Production Deployment](PRODUCTION_DEPLOYMENT.md) - PM2 + cron setup

## Version History

- **2026-02-03**: Initial implementation of SCHEDULED status and auto-activation
