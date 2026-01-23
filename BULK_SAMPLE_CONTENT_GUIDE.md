# Category-wise Sample Content Generation Guide

## Overview

ప్రతి category కి 15 sample articles automatically generate చేసే feature.

---

## Quick Usage

### Method 1: Per Category (Recommended ⭐)

```bash
# Each category కి 15 articles create చేయండి
POST /api/v1/tenants/:tenantId/bootstrap-content
{
  "articlesPerCategory": 15
}

# Example: If domain has 5 categories + 2 languages (EN + TE)
# Total articles = 5 categories × 15 articles × 2 languages = 150 articles
```

### Method 2: With AI-Generated Content (Best Quality 🚀)

```bash
# Each category కి 15 AI-generated unique articles
POST /api/v1/tenants/:tenantId/bootstrap-content
{
  "articlesPerCategory": 15,
  "useAI": true
}
```

**AI Benefits:**
- ✅ Diverse, unique content per article
- ✅ Category-relevant titles
- ✅ 2-3 paragraphs each
- ✅ Natural language (not templates)

---

## Examples

### Example 1: 15 Template Articles Per Category

```bash
curl -X POST "http://localhost:3000/api/v1/tenants/tenant_123/bootstrap-content" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "articlesPerCategory": 15
  }'
```

**Response:**
```json
{
  "success": true,
  "created": {
    "articles": 150,  // 5 categories × 15 × 2 languages
    "epaper": 1
  }
}
```

### Example 2: 15 AI Articles Per Category

```bash
curl -X POST "http://localhost:3000/api/v1/tenants/tenant_123/bootstrap-content" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "articlesPerCategory": 15,
    "useAI": true
  }'
```

### Example 3: Only Specific Count (Not Per Category)

```bash
# Just 20 total articles (old method)
POST /api/v1/tenants/tenant_123/bootstrap-content
{
  "articleCount": 20
}
```

### Example 4: Custom Domain + Per Category

```bash
POST /api/v1/tenants/tenant_123/bootstrap-content
{
  "domainId": "domain_xyz",
  "articlesPerCategory": 10,
  "useAI": true
}
```

---

## How It Works

### Template-Based (Default)

```typescript
// Without AI (fast, simple templates)
{
  "articlesPerCategory": 15,
  "useAI": false  // or omit
}
```

**Generated articles:**
- English: "Politics: Sample Article 1", "Politics: Sample Article 2", ...
- Telugu: "రాజకీయాలు: నమూనా వార్త 1", "రాజకీయాలు: నమూనా వార్త 2", ...

### AI-Generated (Better Quality)

```typescript
// With AI (slower, unique content)
{
  "articlesPerCategory": 15,
  "useAI": true
}
```

**AI generates:**
- Unique titles per article
- 2-3 paragraph content
- Category-relevant topics
- Natural language

**Example AI output:**
```json
{
  "title": "రాష్ట్ర ప్రభుత్వం కొత్త విధానాలు ప్రకటించింది",
  "content": "తాజాగా రాష్ట్ర ప్రభుత్వం విద్యా రంగంలో కొత్త సంస్కరణలు ప్రకటించింది. ఈ విధానాల ప్రకారం..."
}
```

---

## Calculation

### Articles Created Formula:

```
Total Articles = Categories × Articles Per Category × Languages
```

**Example Scenario:**

| Setting | Value |
|---------|-------|
| Categories linked to domain | 8 |
| Languages (EN + TE) | 2 |
| `articlesPerCategory` | 15 |
| **Total Articles** | **240** |

**Breakdown:**
- Politics: 15 EN + 15 TE = 30
- Sports: 15 EN + 15 TE = 30
- Entertainment: 15 EN + 15 TE = 30
- ... (8 categories total)
- **Grand Total: 8 × 30 = 240 articles**

---

## API Parameters

### POST /api/v1/tenants/:tenantId/bootstrap-content

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `domainId` | string | primary domain | Optional domain ID |
| `articlesPerCategory` | number | - | Articles per category (1-20) |
| `useAI` | boolean | false | Use AI to generate diverse content |
| `articleCount` | number | 5 | Total articles (ignores `articlesPerCategory`) |
| `skipArticles` | boolean | false | Skip article creation |
| `skipEpaper` | boolean | false | Skip ePaper creation |

**Priority:**
- If `articlesPerCategory` is set → Uses per-category mode
- Else if `articleCount` is set → Uses total count mode
- Else → Default 5 total articles

---

## Performance

### Template-Based

| Articles | Time | Notes |
|----------|------|-------|
| 150 | ~30 seconds | Fast DB inserts |
| 300 | ~1 minute | Good for testing |

### AI-Generated

| Articles | Time | Notes |
|----------|------|-------|
| 150 | ~5-10 minutes | AI API calls (slow) |
| 300 | ~10-20 minutes | Use for quality demos only |

**Recommendation:**
- Development/Testing → Template-based
- Demo/Production → AI-generated (run once)

---

## Sample Article Tags

All generated articles include these tags:
```typescript
tags: ['sample', 'bootstrap', categorySlug]
```

**Benefits:**
1. Easy to identify sample content
2. Easy to filter/delete
3. Category-specific filtering

**Query Examples:**

```sql
-- All sample articles for "politics" category
SELECT * FROM "Article" 
WHERE tags @> ARRAY['politics', 'sample']::text[];

-- Count per category
SELECT 
  UNNEST(tags) as category,
  COUNT(*) as count
FROM "Article"
WHERE tags @> ARRAY['sample']::text[]
GROUP BY category;
```

---

## Frontend Integration

### React Component

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export function BulkContentGenerator({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false);
  const [perCategory, setPerCategory] = useState(15);
  const [useAI, setUseAI] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/tenants/${tenantId}/bootstrap-content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          articlesPerCategory: perCategory,
          useAI
        })
      });
      const data = await res.json();
      setResult(data);
      alert(`✅ Created ${data.created.articles} articles!`);
    } catch (err) {
      alert('❌ Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border p-6 rounded-lg space-y-4">
      <h3 className="text-lg font-bold">Bulk Content Generator</h3>
      
      <div>
        <label className="block text-sm mb-2">Articles Per Category</label>
        <Input
          type="number"
          min="1"
          max="20"
          value={perCategory}
          onChange={(e) => setPerCategory(Number(e.target.value))}
          disabled={loading}
        />
        <p className="text-xs text-gray-500 mt-1">
          Total: {perCategory} × categories × languages
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="useAI"
          checked={useAI}
          onCheckedChange={(checked) => setUseAI(!!checked)}
          disabled={loading}
        />
        <label htmlFor="useAI" className="text-sm">
          Use AI for unique content (slower, better quality)
        </label>
      </div>

      <Button onClick={handleGenerate} disabled={loading} className="w-full">
        {loading ? '⏳ Generating...' : '🚀 Generate Bulk Content'}
      </Button>

      {result && (
        <div className="mt-4 p-4 bg-green-50 rounded">
          <p className="font-medium">✅ Success!</p>
          <p className="text-sm">Articles: {result.created.articles}</p>
          <p className="text-sm">ePaper: {result.created.epaper}</p>
        </div>
      )}
    </div>
  );
}
```

---

## Cleanup

### Delete All Sample Content

```bash
DELETE /api/v1/tenants/:tenantId/clear-bootstrap-content
```

**Removes:**
- All articles with `sample` or `bootstrap` tags
- All ePaper issues with `[SAMPLE]` in notes

---

## Best Practices

1. **Start Small** - Test with 5 per category first
2. **Use AI Selectively** - Only for production demos (slow)
3. **Tag Properly** - All samples have `sample` + `bootstrap` tags
4. **Monitor Performance** - 300+ articles may take time
5. **Clean Up** - Delete samples before going live

---

## Troubleshooting

### No articles created?

**Check:**
1. Domain has categories? `GET /api/v1/domains/:domainId/categories`
2. Domain has languages? `GET /api/v1/domains/:domainId/languages`
3. Check server logs for `[TenantBootstrap]` errors

### AI generation failing?

**Possible issues:**
1. OpenAI/Gemini API key not set
2. Rate limiting (too many requests)
3. Check `OPENAI_API_KEY` or `GEMINI_API_KEY` in `.env`

**Fallback:** System uses template-based content if AI fails

### Too slow?

**Solutions:**
1. Use template-based (disable AI)
2. Reduce `articlesPerCategory` (e.g., 5 instead of 15)
3. Run during off-peak hours
4. Consider background job (future enhancement)

---

## Comparison: Old vs New

| Feature | Old Method | New Method |
|---------|-----------|------------|
| Total articles | 5 fixed | Customizable |
| Per category | No | **Yes (15)** |
| AI content | No | **Yes** |
| Diverse content | No | **Yes** |
| Languages | 2 max | 2 max |
| Max limit | 10 | 20 per category |

---

## Related Files

- [src/lib/tenantBootstrap.ts](../src/lib/tenantBootstrap.ts) - Core logic
- [src/api/tenants/tenants.routes.ts](../src/api/tenants/tenants.routes.ts) - API endpoints
- [TENANT_SAMPLE_CONTENT_BOOTSTRAP.md](TENANT_SAMPLE_CONTENT_BOOTSTRAP.md) - General guide

---

## Questions?

- **Template vs AI?** Template = fast, simple. AI = slow, unique quality
- **How many articles?** 15 per category is good balance
- **Performance?** Template-based handles 300+ articles easily
- **Copyright?** No issues - we generate content, not scrape

**Next Steps:**
1. Test with 5 per category first
2. Try AI mode on small scale
3. Monitor performance
4. Scale up as needed
