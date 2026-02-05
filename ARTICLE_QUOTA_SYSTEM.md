# Reporter Daily Article Quota System - Implementation Guide

## Overview
Priority-based daily article quota system for reporters with tenant-level defaults and per-reporter overrides.

## Schema Changes

### New Tables

**TenantArticleQuota** - Tenant-wide defaults for all reporters
- `maxPriority1Daily` (default: 5) - High priority articles per day
- `maxPriority2Daily` (default: 10) - Medium priority articles per day
- `maxPriority3Daily` (default: 20) - Low priority articles per day
- `maxTotalDaily` (default: 30) - Total articles per day
- `enforceQuota` (default: true) - Enable/disable quota enforcement

**ReporterArticleQuota** - Per-reporter overrides
- All fields nullable (null = use tenant default)
- `isActive` - Enable/disable custom quota for this reporter

## Migration

Run on production server:
```bash
cd ~/kaburlu_media_backend
npx prisma generate
npx prisma migrate deploy
pm2 restart kaburlu-api
```

## API Endpoints

### 1. Admin: Get Tenant Default Quotas
```
GET /api/v1/tenants/{tenantId}/article-quota
Authorization: TENANT_ADMIN or SUPER_ADMIN

Response:
{
  "maxPriority1Daily": 5,
  "maxPriority2Daily": 10,
  "maxPriority3Daily": 20,
  "maxTotalDaily": 30,
  "enforceQuota": true
}
```

### 2. Admin: Set Tenant Default Quotas
```
PUT /api/v1/tenants/{tenantId}/article-quota
Authorization: TENANT_ADMIN or SUPER_ADMIN

Body:
{
  "maxPriority1Daily": 5,
  "maxPriority2Daily": 10,
  "maxPriority3Daily": 20,
  "maxTotalDaily": 30,
  "enforceQuota": true
}
```

### 3. Admin: Get Reporter Quota Override
```
GET /api/v1/tenants/{tenantId}/reporters/{reporterId}/article-quota
Authorization: TENANT_ADMIN or SUPER_ADMIN

Response:
{
  "reporterQuota": {
    "maxPriority1Daily": 10,  // Custom override
    "maxPriority2Daily": null, // Uses tenant default
    "maxTotalDaily": 40,
    "isActive": true
  },
  "effectiveQuota": {
    "maxPriority1Daily": 10,  // Effective (after override)
    "maxPriority2Daily": 10,  // From tenant default
    "maxPriority3Daily": 20,
    "maxTotalDaily": 40
  }
}
```

### 4. Admin: Set Reporter Quota Override
```
PUT /api/v1/tenants/{tenantId}/reporters/{reporterId}/article-quota
Authorization: TENANT_ADMIN or SUPER_ADMIN

Body:
{
  "maxPriority1Daily": 10,   // Override
  "maxPriority2Daily": null,  // Use tenant default
  "maxPriority3Daily": null,
  "maxTotalDaily": 40,
  "isActive": true
}
```

### 5. Admin: Get All Reporters Quota Summary
```
GET /api/v1/tenants/{tenantId}/reporters/article-quota-summary?date=2026-02-05
Authorization: TENANT_ADMIN or SUPER_ADMIN

Response:
{
  "date": "2026-02-05",
  "tenantDefaults": {
    "maxPriority1Daily": 5,
    "maxPriority2Daily": 10,
    "maxTotalDaily": 30,
    "enforceQuota": true
  },
  "reporters": [
    {
      "reporterId": "...",
      "name": "Reporter Name",
      "quota": {
        "maxPriority1Daily": 10,
        "maxPriority2Daily": 10,
        "maxTotalDaily": 40
      },
      "usage": {
        "priority1Count": 3,
        "priority2Count": 7,
        "totalCount": 12
      },
      "remaining": {
        "priority1": 7,
        "priority2": 3,
        "total": 28
      }
    }
  ]
}
```

### 6. Reporter: Check My Quota & Usage
```
GET /api/v1/reporter/article-quota?date=2026-02-05
Authorization: REPORTER role

Response:
{
  "date": "2026-02-05",
  "quota": {
    "maxPriority1Daily": 5,
    "maxPriority2Daily": 10,
    "maxPriority3Daily": 20,
    "maxTotalDaily": 30
  },
  "usage": {
    "priority1Count": 2,
    "priority2Count": 5,
    "priority3Count": 3,
    "totalCount": 10
  },
  "remaining": {
    "priority1": 3,
    "priority2": 5,
    "priority3": 17,
    "total": 20
  },
  "canPost": {
    "priority1": true,
    "priority2": true,
    "priority3": true
  }
}
```

## Article Priority Field

Need to add `priority` field to Article schema if not exists:

```prisma
model Article {
  // ... existing fields
  priority Int @default(3)  // 1=high, 2=medium, 3=low
}
```

Then migrate:
```bash
npx prisma migrate dev --name add_article_priority
```

## Validation Integration (Next Step)

Add quota check in article creation endpoints:

```typescript
import { checkReporterDailyQuota } from '../../lib/articleQuota';

// In article POST handler
const priority = req.body.priority || 3;
const quotaCheck = await checkReporterDailyQuota(authorId, priority);

if (!quotaCheck.allowed) {
  return res.status(429).json({
    error: 'Daily article quota exceeded',
    quota: quotaCheck.quota,
    usage: quotaCheck.usage,
    remaining: quotaCheck.remaining,
    message: quotaCheck.message
  });
}
```

## Usage Examples

### Example 1: Set Tenant Defaults
```bash
curl -X PUT 'https://api.kaburlumedia.com/api/v1/tenants/YOUR_TENANT_ID/article-quota' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "maxPriority1Daily": 3,
    "maxPriority2Daily": 8,
    "maxPriority3Daily": 15,
    "maxTotalDaily": 25,
    "enforceQuota": true
  }'
```

### Example 2: Give Reporter Custom Limit
```bash
curl -X PUT 'https://api.kaburlumedia.com/api/v1/tenants/YOUR_TENANT_ID/reporters/REPORTER_ID/article-quota' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "maxPriority1Daily": 10,
    "maxTotalDaily": 50,
    "isActive": true
  }'
```

### Example 3: Disable Quota Enforcement
```bash
curl -X PUT 'https://api.kaburlumedia.com/api/v1/tenants/YOUR_TENANT_ID/article-quota' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "enforceQuota": false
  }'
```

## Frontend Integration

### Admin Dashboard Widget
Show daily quota usage for all reporters with visual indicators (progress bars, warnings when near limit).

### Reporter Dashboard Widget
Show own quota usage with:
- Circle progress for each priority
- Remaining counts
- "Can post" status per priority

### Article Create Form
- Before submit: check quota
- Show warning if near limit
- Disable priority selection if quota exceeded for that priority

## Testing

1. Set tenant quota to low values (e.g., 2,3,5,10)
2. Create articles as reporter
3. Verify quota check API shows correct usage
4. Verify article creation blocks when limit reached
5. Set reporter override
6. Verify effective quota changes

## Benefits

- Prevent spam/overload
- Manage reporter workload
- Flexible per-reporter limits
- Real-time quota tracking
- Better resource planning
- Priority-based control

## Notes

- Quotas are per-UTC-day (midnight to midnight UTC)
- No automatic reset mechanism (counts reset naturally at day boundary)
- `enforceQuota: false` → unlimited (quota APIs still work for stats)
- Reporter override `null` values inherit tenant defaults
- Super admins can always post (if needed, add bypass logic)
