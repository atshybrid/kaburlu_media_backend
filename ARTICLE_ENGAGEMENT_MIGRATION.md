# Add Article Engagement & Navigation Fields

## Overview
This migration adds new fields to `TenantWebArticle` for enhanced article engagement and navigation:

### New Fields Added:
1. **isLive** (boolean) - Shows "🔴 LIVE UPDATES" badge for live news
2. **shareCount** (integer) - Tracks social media shares
3. **previousArticleId** (string, nullable) - Links to previous article in sequence
4. **nextArticleId** (string, nullable) - Links to next article in sequence

### Already Existing (No Changes):
- ✅ `isBreaking` - Already exists
- ✅ `viewCount` - Already exists
- ✅ `publishedAt` / `updatedAt` - Already exists

---

## Migration Steps

### Step 1: Run SQL Script in Neon
```bash
# Copy the SQL script to clipboard
cat scripts/add_article_engagement_fields.sql

# Then paste and run it in Neon SQL Editor
# URL: https://console.neon.tech/app/projects/<your-project>/sql-editor
```

### Step 2: Update Prisma Schema
✅ Already done in `prisma/schema.prisma`

### Step 3: Generate Prisma Client
```bash
npm run prisma:generate
```

### Step 4: Create Migration
```bash
npx prisma migrate dev --name add_article_engagement_fields
```

### Step 5: Deploy to Production
```bash
# When ready to deploy to production
npx prisma migrate deploy
```

---

## API Response Changes

### Before:
```json
{
  "id": "article-123",
  "title": "News Title",
  "isBreaking": false,
  "viewCount": 1234
}
```

### After:
```json
{
  "id": "article-123",
  "title": "News Title",
  "isBreaking": false,
  "isLive": true,        // ← NEW
  "viewCount": 1234,
  "shareCount": 56,      // ← NEW
  "previousArticle": {   // ← NEW
    "id": "prev-123",
    "slug": "previous-article",
    "title": "Previous Title",
    "coverImageUrl": "..."
  },
  "nextArticle": {       // ← NEW
    "id": "next-456",
    "slug": "next-article",
    "title": "Next Title",
    "coverImageUrl": "..."
  }
}
```

---

## Backend Code Updates Needed

### 1. Update Article Detail Endpoint (`src/api/public/public.routes.ts`)

Add to the query select:
```typescript
select: {
  // ... existing fields
  isLive: true,           // ← ADD
  shareCount: true,       // ← ADD
  previousArticleId: true, // ← ADD
  nextArticleId: true     // ← ADD
}
```

### 2. Fetch Previous/Next Articles

Add after fetching the main article:
```typescript
// Fetch previous and next articles for navigation
let previousArticle = null;
let nextArticle = null;

if (a.previousArticleId) {
  previousArticle = await p.tenantWebArticle.findUnique({
    where: { id: a.previousArticleId },
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true
    }
  });
}

if (a.nextArticleId) {
  nextArticle = await p.tenantWebArticle.findUnique({
    where: { id: a.nextArticleId },
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true
    }
  });
}

// Add to response
detail.isLive = a.isLive;
detail.shareCount = a.shareCount;
detail.previousArticle = previousArticle;
detail.nextArticle = nextArticle;
```

### 3. Auto-Link Articles (Background Job/Script)

Create a script to automatically set previousArticleId/nextArticleId:
```typescript
// scripts/link_article_navigation.ts
import prisma from '../src/lib/prisma';

async function linkArticles() {
  const articles = await prisma.tenantWebArticle.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, publishedAt: true, tenantId: true }
  });

  for (let i = 0; i < articles.length; i++) {
    const current = articles[i];
    const previous = articles[i + 1]; // Older article
    const next = articles[i - 1];     // Newer article

    await prisma.tenantWebArticle.update({
      where: { id: current.id },
      data: {
        previousArticleId: previous?.id || null,
        nextArticleId: next?.id || null
      }
    });
  }

  console.log(`✅ Linked ${articles.length} articles`);
}

linkArticles();
```

### 4. Update Unified Article Controller

When creating new articles, auto-link to previous:
```typescript
// In createUnifiedArticle (src/api/articles/unified.controller.ts)

// Find most recent article in same tenant
const latestArticle = await tx.tenantWebArticle.findFirst({
  where: {
    tenantId,
    status: 'PUBLISHED'
  },
  orderBy: { publishedAt: 'desc' },
  select: { id: true }
});

// Create new article with link to previous
tenantWebArticle = await tx.tenantWebArticle.create({
  data: {
    // ... existing fields
    isLive: webArticle.isLive || false,
    previousArticleId: latestArticle?.id || null,
    // ... rest of fields
  }
});

// Update the previous article's nextArticleId to point to new article
if (latestArticle) {
  await tx.tenantWebArticle.update({
    where: { id: latestArticle.id },
    data: { nextArticleId: tenantWebArticle.id }
  });
}
```

---

## Testing

### Test SQL Changes:
```sql
-- Check new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'TenantWebArticle'
  AND column_name IN ('isLive', 'shareCount', 'previousArticleId', 'nextArticleId');

-- Test data update
UPDATE "TenantWebArticle"
SET "isLive" = true, "shareCount" = 10
WHERE "slug" = 'test-article';

-- Verify
SELECT id, slug, "isLive", "shareCount", "previousArticleId", "nextArticleId"
FROM "TenantWebArticle"
WHERE "slug" = 'test-article';
```

### Test API:
```bash
curl http://localhost:3001/api/v1/public/articles/test-slug | jq '.isLive, .shareCount, .previousArticle, .nextArticle'
```

---

## Performance Indexes Created

```sql
-- Breaking news filter
CREATE INDEX "TenantWebArticle_isBreaking_idx" 
ON "TenantWebArticle" ("tenantId", "isBreaking") 
WHERE "isBreaking" = true;

-- Live news filter
CREATE INDEX "TenantWebArticle_isLive_idx" 
ON "TenantWebArticle" ("tenantId", "isLive") 
WHERE "isLive" = true;

-- Share count sorting
CREATE INDEX "TenantWebArticle_shareCount_idx" 
ON "TenantWebArticle" ("tenantId", "shareCount");
```

---

## Summary

✅ SQL script ready: `scripts/add_article_engagement_fields.sql`
✅ Prisma schema updated
✅ Indexes for performance
✅ Code examples provided
✅ Testing commands included

Run the SQL in Neon, then:
```bash
npm run prisma:generate
npx prisma migrate dev --name add_article_engagement_fields
```
