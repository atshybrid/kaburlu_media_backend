# Domain Sample Content Auto-Population & Backfill Guide

## Overview

When a tenant domain is verified (status changes to ACTIVE), the system **automatically generates sample content** to give the new publication a professional starting point. This includes:

- **Real news articles** from NewsData.io API (Telugu + English sources)
- **15 articles per category** with images
- **Sample ePaper issue** (for EPAPER domains)

## Automatic Trigger

The auto-population happens **automatically** when:

1. Domain verification completes (`POST /domains/:id/verify`)
2. Domain status changes to `ACTIVE`
3. Sample content generation starts in background (fire-and-forget)

No manual action required! The system handles it automatically.

## Status Tracking

### Domain Status Fields

Each domain now has 3 new fields to track sample content generation:

```typescript
{
  sampleDataStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | null,
  sampleDataMessage: string, // Human-readable status message
  sampleDataGeneratedAt: Date | null // When generation completed
}
```

### Status Flow

```
null → IN_PROGRESS → COMPLETED
                   ↘ FAILED (on error)
```

### Example Response

```json
GET /domains/{tenantId}

{
  "id": "dom_123",
  "domain": "telugutimes.com",
  "status": "ACTIVE",
  "sampleDataStatus": "COMPLETED",
  "sampleDataMessage": "Generated 105 articles",
  "sampleDataGeneratedAt": "2025-01-21T10:30:00.000Z",
  ...
}
```

## NewsData.io Integration

### What is NewsData.io?

NewsData.io is a **real news aggregation API** that provides:

- 📰 **50+ Indian news sources** (Telugu, English, Hindi)
- 🆓 **200 requests/day** on free tier
- ✅ **Legal & licensed** content (no copyright issues)
- 🔄 **Updated hourly** with fresh news

### Article Priority

The system uses a **3-tier fallback**:

1. **NewsData.io** (preferred) - Real news from trusted sources
2. **AI-generated** (if `useAI=true`) - GPT-4 generated content
3. **Templates** (fallback) - Static template articles

### Supported Languages

- `te` (Telugu) - తెలుగు వార్తలు
- `en` (English) - English news
- `hi` (Hindi) - हिंदी समाचार

### Category Mapping

NewsData.io categories → Internal categories:

| NewsData Category | Internal Slugs |
|-------------------|----------------|
| `politics` | politics, government |
| `sports` | sports |
| `business` | business, economy |
| `entertainment` | entertainment, cinema |
| `health` | health |
| `science` | science, technology |
| `technology` | tech, digital |

## Backfill for Existing Domains

If you have **existing verified domains** that were created **before this feature**, you can manually trigger content generation:

### Endpoint

```http
POST /api/v1/domains/:domainId/backfill-content
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "force": false,              // true = regenerate even if exists
  "articlesPerCategory": 15,   // 1-20 articles per category
  "useAI": false,              // Use AI for content generation
  "useNewsAPI": true,          // Use NewsData.io for real news (recommended)
  "addImages": true,           // Add images to articles
  "imageSource": "placeholder" // 'placeholder' | 'unsplash'
}
```

### Response

```json
{
  "message": "Sample content generation started",
  "status": "IN_PROGRESS",
  "domainId": "dom_123",
  "tenantId": "tenant_456",
  "options": {
    "articlesPerCategory": 15,
    "useAI": false,
    "useNewsAPI": true,
    "addImages": true,
    "imageSource": "placeholder"
  }
}
```

### Check Status

After triggering backfill, check the domain status:

```http
GET /api/v1/domains/{tenantId}
```

Look for:
- `sampleDataStatus: "COMPLETED"`
- `sampleDataMessage: "Generated 105 articles"`
- `sampleDataGeneratedAt: "2025-01-21T..."`

### Backfill Behavior

| Scenario | `force=false` | `force=true` |
|----------|---------------|--------------|
| No sample data exists | ✅ Generates new content | ✅ Generates new content |
| Sample data exists | ❌ Returns existing count | ✅ Regenerates all content |
| Status = IN_PROGRESS | ❌ Already running | ✅ Starts new generation |
| Status = FAILED | ✅ Retries generation | ✅ Retries generation |

### Example: Backfill All Existing Domains

```bash
# 1. Get all verified domains without sample data
curl -X GET "https://api.yourapp.com/api/v1/domains" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[] | select(.status == "ACTIVE" and .sampleDataStatus == null) | .id'

# 2. Backfill each domain
for domain_id in $(cat domain_ids.txt); do
  curl -X POST "https://api.yourapp.com/api/v1/domains/$domain_id/backfill-content" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "articlesPerCategory": 15,
      "useNewsAPI": true,
      "addImages": true
    }'
  
  echo "Triggered backfill for $domain_id"
  sleep 2  # Rate limiting
done
```

## Manual Bootstrap (Alternative)

You can also use the tenant-level bootstrap endpoint:

```http
POST /api/v1/tenants/:tenantId/bootstrap-content
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "domainId": "dom_123",       // Required: which domain to bootstrap
  "articlesPerCategory": 15,   // Optional: articles per category (default: 15)
  "useAI": false,              // Optional: use AI generation (default: false)
  "useNewsAPI": true,          // Optional: use NewsData.io (default: true)
  "addImages": true,           // Optional: add images (default: true)
  "imageSource": "placeholder" // Optional: 'placeholder' | 'unsplash'
}
```

## Generated Content Details

### Articles

For each category × language combination, generates **15 articles** with:

```json
{
  "title": "Real news headline from NewsData.io",
  "content": "Full article content or description",
  "type": "reporter",
  "status": "PUBLISHED",
  "publishedAt": "<random_date_last_7_days>",
  "imageUrl": "https://placehold.co/1200x675/...",  // or Unsplash
  "sourceUrl": "https://source-news-site.com/...",  // Original source
  "tags": ["sample", "bootstrap", "politics"],
  "categories": [{ "id": "cat_123" }],
  "languageId": "lang_te",
  "tenantId": "tenant_456",
  "seo": {
    "seoTitle": "...",
    "seoDescription": "...",
    "seoKeywords": ["sample", "politics", "te"]
  }
}
```

### Images

**Placeholder mode** (recommended):
- Category-specific colors (15 unique colors)
- Format: `https://placehold.co/1200x675/4A90E2/FFFFFF?text=Politics`
- Fast, reliable, no external dependencies

**Unsplash mode**:
- Real stock photos
- Format: `https://source.unsplash.com/featured/1200x675/?news,politics`
- May be slower, subject to Unsplash rate limits

### ePaper (EPAPER domains only)

Creates a sample ePaper issue with:
- Issue name: "Sample ePaper Issue - {DATE}"
- Status: DRAFT
- Sample pages and clips

## Migration

### Run Migration

```bash
# Development
npm run prisma:migrate:dev

# Production (Render, etc.)
npm run prisma:migrate:deploy
```

### Migration Files

- `prisma/migrations/20250121_add_domain_sample_data_status/migration.sql`
- Adds 3 fields: `sampleDataStatus`, `sampleDataMessage`, `sampleDataGeneratedAt`
- **Idempotent** - safe to run multiple times

## Environment Variables

### Required

```env
# NewsData.io API Key (free tier: 200 requests/day)
NEWSDATA_API_KEY=pub_4d60772ce86e4cf7aaed3a076a8ddbb5
```

### Optional (AI Fallback)

```env
# OpenAI API Key (for AI-generated content as fallback)
OPENAI_API_KEY=sk-...
```

## Monitoring & Logs

### Server Logs

```
[TenantBootstrap] Starting for tenant=tenant_456, domain=dom_123
[TenantBootstrap] Fetching real news from NewsData.io for politics (te)
[TenantBootstrap] Created 15 articles for category: Politics
[TenantBootstrap] Created 15 articles for category: Sports
...
[TenantBootstrap] Complete: 105 articles, 0 epaper
```

### Error Handling

If NewsData.io fails:
```
[TenantBootstrap] NewsData.io fetch failed, falling back to templates
```

If entire bootstrap fails:
```
[TenantBootstrap] Error: <error_message>
Domain.sampleDataStatus = 'FAILED'
Domain.sampleDataMessage = 'Error: <error_message>'
```

## Best Practices

### 1. Use NewsData.io (Real News)

✅ **DO**: Use `useNewsAPI: true` (default)
- Legal, licensed content
- Fresh, real news from trusted sources
- Better user experience

❌ **DON'T**: Use only templates
- Generic, fake content
- Poor user experience
- Looks unprofessional

### 2. Rate Limiting

NewsData.io free tier: **200 requests/day**

- Each category fetch = 1 request
- 7 categories × 2 languages = **14 requests per domain**
- Can bootstrap **~14 domains/day** on free tier

**Solution**: Implement request queue or upgrade to paid tier.

### 3. Backfill Strategy

For **large-scale backfills** (100+ domains):

```javascript
// Batch processing with delays
async function backfillAllDomains() {
  const domains = await getDomains({ status: 'ACTIVE', sampleDataStatus: null });
  
  for (const domain of domains) {
    await axios.post(`/domains/${domain.id}/backfill-content`, {
      useNewsAPI: true,
      articlesPerCategory: 15
    });
    
    console.log(`Backfilled: ${domain.domain}`);
    await sleep(5000); // 5 second delay between requests
  }
}
```

### 4. Monitoring

Set up alerts for:
- `sampleDataStatus = 'FAILED'` domains
- NewsData.io API quota exhaustion
- Long-running `IN_PROGRESS` statuses (>10 minutes)

## Troubleshooting

### Issue: Sample data not generating

**Check:**
1. Domain status = `ACTIVE`? → Must be verified first
2. Categories linked to domain? → Need `DomainCategory` entries
3. Languages linked to domain? → Need `DomainLanguage` entries
4. NewsData.io API key set? → Check `NEWSDATA_API_KEY` env var

### Issue: sampleDataStatus stuck on IN_PROGRESS

**Cause**: Background process crashed or still running

**Solution**:
```bash
# Check server logs for errors
pm2 logs kaburlu-backend

# Retry with force=true
curl -X POST "/domains/{domainId}/backfill-content" \
  -d '{"force": true}'
```

### Issue: NewsData.io returns no articles

**Cause**: Category/language combination has no news

**Solution**: System falls back to templates automatically. Check logs:
```
[TenantBootstrap] NewsData.io returned 0 articles, using templates
```

### Issue: Rate limit exceeded

**Error**: `429 Too Many Requests` from NewsData.io

**Solution**:
1. Wait 24 hours for quota reset
2. Upgrade to paid tier ($29/month for 3000 requests)
3. Use `useAI: true` as temporary fallback

## API Reference

### POST /domains/:domainId/backfill-content

Manually trigger sample content generation for existing domain.

**Auth**: Required (JWT)

**Parameters**:
- `domainId` (path): Domain ID

**Body**:
```json
{
  "force": false,              // Optional: force regeneration
  "articlesPerCategory": 15,   // Optional: 1-20 (default: 15)
  "useAI": false,              // Optional: use AI (default: false)
  "useNewsAPI": true,          // Optional: use NewsData.io (default: true)
  "addImages": true,           // Optional: add images (default: true)
  "imageSource": "placeholder" // Optional: 'placeholder' | 'unsplash'
}
```

**Response**:
```json
{
  "message": "Sample content generation started",
  "status": "IN_PROGRESS",
  "domainId": "dom_123",
  "tenantId": "tenant_456",
  "options": { ... }
}
```

**Error Responses**:
- `404` - Domain not found
- `400` - Domain not verified (status != ACTIVE)
- `500` - Internal error

### GET /domains/:tenantId

Get all domains for tenant (includes sample data status).

**Response**:
```json
[
  {
    "id": "dom_123",
    "domain": "telugutimes.com",
    "status": "ACTIVE",
    "sampleDataStatus": "COMPLETED",
    "sampleDataMessage": "Generated 105 articles",
    "sampleDataGeneratedAt": "2025-01-21T10:30:00.000Z",
    ...
  }
]
```

## Examples

### Example 1: New Domain Auto-Trigger

```bash
# 1. User creates domain
POST /api/v1/tenants/tenant_456/domains
{ "domain": "mynews.com", "kind": "NEWS" }

# 2. User verifies domain
POST /api/v1/domains/dom_123/verify

# 3. System auto-triggers bootstrap (background)
# - Status changes: null → IN_PROGRESS → COMPLETED
# - Creates 105 articles (7 categories × 15 articles × 1 language)

# 4. Check status
GET /api/v1/domains/tenant_456
{
  "sampleDataStatus": "COMPLETED",
  "sampleDataMessage": "Generated 105 articles",
  "sampleDataGeneratedAt": "2025-01-21T10:30:00.000Z"
}
```

### Example 2: Backfill Existing Domain

```bash
# Domain was created before auto-bootstrap feature
# Status shows: sampleDataStatus = null

# Trigger backfill
POST /api/v1/domains/dom_123/backfill-content
{
  "articlesPerCategory": 10,
  "useNewsAPI": true
}

# Response
{
  "message": "Sample content generation started",
  "status": "IN_PROGRESS"
}

# Wait 30-60 seconds...

# Check completion
GET /api/v1/domains/tenant_456
{
  "sampleDataStatus": "COMPLETED",
  "sampleDataMessage": "Generated 70 articles"
}
```

### Example 3: Regenerate Content

```bash
# Existing domain has old sample data
# Want to refresh with new NewsData.io articles

POST /api/v1/domains/dom_123/backfill-content
{
  "force": true,           // Force regeneration
  "articlesPerCategory": 15,
  "useNewsAPI": true,
  "imageSource": "unsplash" // Upgrade to real photos
}

# System deletes old bootstrap articles and creates fresh ones
```

## Summary

✅ **Automatic** - Triggers on domain verification
✅ **Real news** - Uses NewsData.io API (200/day free)
✅ **Status tracking** - Monitor progress via API
✅ **Backfill support** - Manually trigger for existing domains
✅ **Idempotent** - Safe to run multiple times with `force` flag

**Next Steps**:
1. Run migration: `npm run prisma:migrate:dev`
2. Add NewsData.io API key to `.env`
3. Verify new domains → auto-generates content
4. Backfill existing domains using `/backfill-content` endpoint
