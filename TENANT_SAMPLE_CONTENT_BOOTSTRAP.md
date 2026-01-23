# Tenant Sample Content Bootstrap

## Overview

కొత్త tenant domain create చేసినప్పుడు automatically sample content (articles + ePaper) generate చేసే system.

## Features

✅ **Automatic Bootstrap** - Domain verification అయినప్పుడు automatically sample content create  
✅ **Multi-language Support** - Telugu & English articles (if languages are configured)  
✅ **Category-aware** - Domain categories ప్రకారం articles distribute అవుతాయి  
✅ **ePaper Support** - EPAPER domains కి sample ePaper issue create అవుతుంది  
✅ **Manual Trigger** - Admin dashboard నుండి on-demand generate చేయవచ్చు  
✅ **Easy Cleanup** - Sample content ని delete చేయవచ్చు

---

## Sample Content Created

### 📰 Articles (5 default, customizable up to 10)

| Title (English) | Title (Telugu) | Type |
|----------------|---------------|------|
| Welcome to {TenantName} | {TenantName}కి స్వాగతం | Welcome |
| Breaking News: Sample Article | బ్రేకింగ్ న్యూస్: నమూనా వ్యాసం | Breaking |
| Featured Story: Getting Started | ఫీచర్ స్టోరీ: ప్రారంభించడం | Feature |
| Local News Update | స్థానిక వార్తల నవీకరణ | Local |
| Opinion: Editorial Sample | అభిప్రాయం: సంపాదకీయ నమూనా | Opinion |

**Article Properties:**
- Status: `PUBLISHED` (immediate visibility)
- Tags: `['sample', 'bootstrap']` (easy identification)
- SEO: Auto-generated (title, description, keywords)
- Author: First available SUPER_ADMIN/REPORTER user

### 📄 ePaper (EPAPER domains only)

- **Placeholder PDF**: 800x1200px sample image
- **Status**: `PUBLISHED`
- **Language**: Domain's primary language
- **Pages**: 1
- **Notes**: `[SAMPLE]` tag for identification

---

## How It Works

### 1. **Automatic Trigger** (Recommended)

Domain verification success అయినప్పుడు automatically sample content create అవుతుంది:

```bash
# Domain verify చేసినప్పుడు
POST /api/v1/domains/:domainId/verify
{
  "method": "MANUAL",
  "force": true
}

# Response - domain ACTIVE అవగానే background లో bootstrap runs
{
  "ok": true,
  "domain": { "id": "...", "status": "ACTIVE", ... }
}
```

**Backend Flow:**
1. Domain status → `ACTIVE`
2. Auto-link default categories
3. **Auto-trigger `bootstrapTenantContent()`** (fire-and-forget)
4. Sample articles + ePaper created in background

### 2. **Manual Trigger** (Admin Control)

Admin dashboard నుండి manually sample content generate చేయవచ్చు:

```bash
POST /api/v1/tenants/:tenantId/bootstrap-content
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "domainId": "optional-domain-id",  # Omit to use primary domain
  "articleCount": 5,                 # 1-10 articles (default: 5)
  "skipArticles": false,             # Skip article creation
  "skipEpaper": false                # Skip ePaper creation
}
```

**Response:**
```json
{
  "success": true,
  "created": {
    "articles": 10,  // 5 English + 5 Telugu
    "epaper": 1
  }
}
```

**Examples:**

```bash
# Default: 5 articles + ePaper
POST /api/v1/tenants/tenant_123/bootstrap-content
{}

# Only 3 articles
POST /api/v1/tenants/tenant_123/bootstrap-content
{ "articleCount": 3 }

# Only ePaper (skip articles)
POST /api/v1/tenants/tenant_123/bootstrap-content
{ "skipArticles": true }

# Custom domain
POST /api/v1/tenants/tenant_123/bootstrap-content
{ "domainId": "domain_xyz" }
```

### 3. **Cleanup** (Remove Sample Content)

Sample content delete చేయడానికి:

```bash
DELETE /api/v1/tenants/:tenantId/clear-bootstrap-content
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "deleted": {
    "articles": 10,
    "epaper": 1
  }
}
```

---

## Requirements

Sample content create అవ్వడానికి tenant లో ఈ data ఉండాలి:

### ✅ Minimum Requirements

1. **Categories** - Domain తో link చేసిన categories కనీసం 1 (auto-linked on domain verify)
2. **Languages** - Domain తో link చేసిన languages కనీసం 1
3. **Author User** - SUPER_ADMIN/REPORTER/TENANT_ADMIN role తో కనీసం 1 user

### ⚠️ Optional (but recommended)

- **State linkage** - Tenant state config చేసినట్లయితే state-specific categories add అవుతాయి
- **Multiple languages** - English + Telugu configured అయితే both languages లో articles create అవుతాయి
- **EPAPER domain** - ePaper sample కోసం EPAPER kind domain అవసరం

---

## Sample Content Identification

Sample/bootstrap content identify చేయడానికి:

### Tags
```typescript
article.tags includes 'sample' or 'bootstrap'
```

### ePaper Notes
```typescript
epaperIssue.notes includes '[SAMPLE]'
```

### Database Queries

```sql
-- All sample articles
SELECT * FROM "Article" 
WHERE tags @> ARRAY['sample']::text[] 
   OR tags @> ARRAY['bootstrap']::text[];

-- All sample ePaper issues
SELECT * FROM "EpaperPdfIssue" 
WHERE notes LIKE '%[SAMPLE]%';

-- Count by tenant
SELECT tenantId, COUNT(*) as sample_articles
FROM "Article"
WHERE tags && ARRAY['sample', 'bootstrap']::text[]
GROUP BY tenantId;
```

---

## Frontend Integration

### React/Next.js Admin Dashboard

```typescript
// Generate sample content
async function generateSampleContent(tenantId: string) {
  const response = await fetch(
    `/api/v1/tenants/${tenantId}/bootstrap-content`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        articleCount: 5
      })
    }
  );
  
  const result = await response.json();
  console.log(`Created ${result.created.articles} articles, ${result.created.epaper} ePaper`);
}

// Clear sample content
async function clearSampleContent(tenantId: string) {
  const response = await fetch(
    `/api/v1/tenants/${tenantId}/clear-bootstrap-content`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const result = await response.json();
  console.log(`Deleted ${result.deleted.articles} articles, ${result.deleted.epaper} ePaper`);
}
```

### UI Component Example

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function TenantSampleContentCard({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/tenants/${tenantId}/bootstrap-content`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setResult(data);
      alert(`✅ Created ${data.created.articles} articles + ${data.created.epaper} ePaper`);
    } catch (err) {
      alert('❌ Failed to generate sample content');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Delete all sample content?')) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/tenants/${tenantId}/clear-bootstrap-content`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      alert(`🗑️ Deleted ${data.deleted.articles} articles + ${data.deleted.epaper} ePaper`);
    } catch (err) {
      alert('❌ Failed to clear sample content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border p-4 rounded-lg">
      <h3 className="font-bold mb-2">Sample Content</h3>
      <p className="text-sm text-gray-600 mb-4">
        Generate demo articles and ePaper for testing
      </p>
      
      <div className="flex gap-2">
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating...' : '🚀 Generate Samples'}
        </Button>
        <Button onClick={handleClear} variant="outline" disabled={loading}>
          🗑️ Clear Samples
        </Button>
      </div>

      {result && (
        <div className="mt-4 p-2 bg-green-50 rounded text-sm">
          ✅ Created: {result.created.articles} articles, {result.created.epaper} ePaper
        </div>
      )}
    </div>
  );
}
```

---

## Testing

### Local Testing

```bash
# 1. Create test tenant
curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test News","slug":"test-news","prgiNumber":"TEST-001"}'

# 2. Add domain
curl -X POST http://localhost:3000/api/v1/tenants/TENANT_ID/domains \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domain":"test.local","isPrimary":true}'

# 3. Verify domain (triggers auto-bootstrap)
curl -X POST http://localhost:3000/api/v1/domains/DOMAIN_ID/verify \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method":"MANUAL","force":true}'

# 4. Check created articles
curl http://localhost:3000/api/v1/articles?tenantId=TENANT_ID

# 5. Manually trigger more samples
curl -X POST http://localhost:3000/api/v1/tenants/TENANT_ID/bootstrap-content \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"articleCount":3}'
```

### Verify Sample Content

```bash
# Check sample articles exist
curl "http://localhost:3000/api/v1/articles?tags=sample&tenantId=TENANT_ID"

# Check ePaper samples
curl "http://localhost:3000/api/v1/epaper/issues?tenantId=TENANT_ID"
```

---

## Troubleshooting

### No articles created?

**Check:**
1. Domain has categories linked? `GET /api/v1/domains/:domainId/categories`
2. Domain has languages linked? `GET /api/v1/domains/:domainId/languages`
3. User exists with SUPER_ADMIN/REPORTER role?
4. Check server logs for `[TenantBootstrap]` errors

### Duplicate articles?

Bootstrap module checks for existing sample content before creating:
```typescript
const existing = await prisma.article.findMany({
  where: { tenantId, tags: { hasSome: ['sample', 'bootstrap'] } }
});

if (existing.length >= count) {
  // Skip creation
}
```

### Clear all samples and regenerate

```bash
# 1. Clear existing
DELETE /api/v1/tenants/:tenantId/clear-bootstrap-content

# 2. Regenerate
POST /api/v1/tenants/:tenantId/bootstrap-content
{ "articleCount": 5 }
```

---

## API Reference

### POST /api/v1/tenants/:tenantId/bootstrap-content

**Auth:** JWT (SUPER_ADMIN or TENANT_ADMIN)

**Body:**
```typescript
{
  domainId?: string;        // Optional (uses primary domain if omitted)
  articleCount?: number;    // 1-10 (default: 5)
  skipArticles?: boolean;   // Skip article creation
  skipEpaper?: boolean;     // Skip ePaper creation
}
```

**Response:**
```typescript
{
  success: boolean;
  created: {
    articles: number;
    epaper: number;
  }
}
```

### DELETE /api/v1/tenants/:tenantId/clear-bootstrap-content

**Auth:** JWT (SUPER_ADMIN or TENANT_ADMIN)

**Response:**
```typescript
{
  deleted: {
    articles: number;
    epaper: number;
  }
}
```

---

## Related Files

- [src/lib/tenantBootstrap.ts](../src/lib/tenantBootstrap.ts) - Core bootstrap logic
- [src/api/tenants/tenants.routes.ts](../src/api/tenants/tenants.routes.ts) - API endpoints
- [src/api/domains/domains.routes.ts](../src/api/domains/domains.routes.ts) - Auto-trigger on verify
- [scripts/seed_demo_prashna.ts](../scripts/seed_demo_prashna.ts) - Example seed script

---

## Best Practices

1. **Auto-bootstrap on domain verify** - Users see content immediately
2. **Add "Clear Samples" button** - Let admins clean up test data
3. **Customize templates** - Edit [src/lib/tenantBootstrap.ts](../src/lib/tenantBootstrap.ts) article templates for your brand
4. **Tag properly** - Always use `['sample', 'bootstrap']` tags for easy filtering
5. **Don't commit sample content** - Use fire-and-forget, not migrations

---

**Questions?** Check [FRONTEND_NEXTJS_INTEGRATION.md](FRONTEND_NEXTJS_INTEGRATION.md) or [TENANT_ADMIN_API_INTEGRATION.md](TENANT_ADMIN_API_INTEGRATION.md)
