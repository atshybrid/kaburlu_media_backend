# Article Listing APIs - Quick Reference

## Overview
Role-based article listing and detail retrieval with advanced filters for different user types.

## Endpoints

### 1. Super Admin & Desk Editor
```
GET /api/v1/articles/list/superadmin
Authorization: Bearer {token}
```

**Who can access:** Super Admin, Desk Editor

**Filters:**
- `tenantId` - Filter by specific tenant
- `stateId` - Filter by state (includes all districts/mandals in that state)
- `districtId` - Filter by district (includes all mandals in that district)
- `mandalId` - Filter by specific mandal
- `reporterId` - Filter by specific reporter
- `priority` - Filter by priority (1=high, 2=medium, 3=low)
- `date` - Filter by date (YYYY-MM-DD format, defaults to today)
- `minChars` - Minimum character count in content
- `maxChars` - Maximum character count in content
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 200)

**Example:**
```bash
# Get all high-priority articles from specific tenant created today
curl 'https://api.kaburlumedia.com/api/v1/articles/list/superadmin?tenantId=cmk7e7tg401ezlp22wkz5rxky&priority=1' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Get articles from specific district on specific date
curl 'https://api.kaburlumedia.com/api/v1/articles/list/superadmin?districtId=DISTRICT_ID&date=2026-02-05' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Get articles with character count between 500-1000
curl 'https://api.kaburlumedia.com/api/v1/articles/list/superadmin?minChars=500&maxChars=1000' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Response:**
```json
{
  "articles": [
    {
      "id": "...",
      "title": "Article title",
      "content": "Full content...",
      "createdAt": "2026-02-05T10:30:00Z",
      "updatedAt": "2026-02-05T10:30:00Z",
      "status": "DRAFT",
      "type": "reporter",
      "priority": 1,
      "viewCount": 0,
      "isBreakingNews": false,
      "isTrending": false,
      "tags": [],
      "images": [],
      "characterCount": 850,
      "author": {
        "id": "...",
        "mobileNumber": "1234567890",
        "email": "reporter@example.com",
        "reporterProfile": {
          "id": "...",
          "level": "MANDAL",
          "state": { "id": "...", "name": "Telangana" },
          "district": { "id": "...", "name": "Hyderabad" },
          "mandal": { "id": "...", "name": "Secunderabad" },
          "designation": {
            "name": "Mandal Reporter",
            "nativeName": "మండల రిపోర్టర్"
          }
        }
      },
      "tenant": {
        "id": "...",
        "name": "Tenant Name",
        "slug": "tenant-slug"
      },
      "language": {
        "id": "...",
        "name": "Telugu",
        "code": "te"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3,
  "filters": {
    "tenantId": "...",
    "priority": 1,
    "date": "2026-02-05"
  }
}
```

---

### 2. Tenant Admin
```
GET /api/v1/articles/list/tenant
Authorization: Bearer {token}
```

**Who can access:** Tenant Admin only (automatically scoped to their tenant)

**Filters:**
- `stateId` - Filter by state
- `districtId` - Filter by district
- `mandalId` - Filter by mandal
- `reporterId` - Filter by specific reporter
- `priority` - Filter by priority (1, 2, or 3)
- `date` - Filter by date (defaults to today)
- `minChars` - Minimum character count
- `maxChars` - Maximum character count
- `page` - Page number
- `limit` - Items per page

**Example:**
```bash
# Get today's high-priority articles from my tenant
curl 'https://api.kaburlumedia.com/api/v1/articles/list/tenant?priority=1' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Get articles from specific mandal
curl 'https://api.kaburlumedia.com/api/v1/articles/list/tenant?mandalId=MANDAL_ID' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Response:** Same as superadmin (without tenantId in filters)

---

### 3. Reporter
```
GET /api/v1/articles/list/reporter
Authorization: Bearer {token}
```

**Who can access:** Reporter only (only their own articles)

**Filters:**
- `priority` - Filter by priority (1, 2, or 3)
- `date` - Filter by date (defaults to today)
- `minChars` - Minimum character count
- `maxChars` - Maximum character count
- `page` - Page number
- `limit` - Items per page

**Example:**
```bash
# Get my articles from today
curl 'https://api.kaburlumedia.com/api/v1/articles/list/reporter' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Get my high-priority articles from specific date
curl 'https://api.kaburlumedia.com/api/v1/articles/list/reporter?priority=1&date=2026-02-01' \
  -H 'Authorization: Bearer YOUR_TOKEN'

# Get my articles with more than 1000 characters
curl 'https://api.kaburlumedia.com/api/v1/articles/list/reporter?minChars=1000' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Response:** Same structure but without reporter details (since it's the user's own articles)

---

## 4. Get Article by ID (All Roles)

```
GET /api/v1/articles/{id}/detail
Authorization: Bearer {token}
```

**Who can access:** 
- **Super Admin/Desk Editor**: Can view any article
- **Tenant Admin**: Can view articles within their tenant only
- **Reporter**: Can view only their own articles

**Parameters:**
- `id` (path) - Article ID (required)

**Example:**
```bash
# Get article details
curl 'https://api.kaburlumedia.com/api/v1/articles/cm1article123xyz/detail' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Response (200 OK):**
```json
{
  "id": "cm1article123xyz",
  "title": "హైదరాబాద్‌లో రోడ్డు ప్రమాదం",
  "content": "హైదరాబాద్ సెకండరాబాద్ మండలంలో ఈ రోజు ఉదయం రోడ్డు ప్రమాదం జరిగింది...",
  "characterCount": 243,
  "createdAt": "2026-02-06T06:30:00.000Z",
  "updatedAt": "2026-02-06T06:30:00.000Z",
  "scheduledAt": null,
  "status": "PUBLISHED",
  "type": "reporter",
  "priority": 1,
  "viewCount": 45,
  "isBreakingNews": true,
  "isTrending": false,
  "tags": ["road-accident", "hyderabad", "breaking"],
  "images": ["https://kaburlu-news.b-cdn.net/articles/accident-photo-1.webp"],
  "headlines": "హైదరాబాద్‌లో ప్రమాదం",
  "longNews": "దీర్ఘ వార్త కంటెంట్...",
  "shortNews": "చిన్న వార్త...",
  "contentJson": null,
  "authorId": "user123",
  "aArticle Detail Page
```javascript
// Frontend: Show full article when user clicks on article card
const articleId = 'cm1article123xyz';
const response = await fetch(`/api/v1/articles/${articleId}/detail`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const article = await response.json();

// Display full article with:
// - Title, content, images
// - Author details (name, designation, location)
// - Categories, tags
// - View count, trending/breaking status
// - Priority indicator
```

### uthor": {
    "id": "user123",
    "mobileNumber": "9876543210",
    "email": "reporter1@kaburlumedia.com",
    "reporterProfile": {
      "id": "reporter123",
      "level": "MANDAL",
      "state": {
        "id": "state_telangana",
        "name": "Telangana"
      },
      "district": {
        "id": "dist_hyderabad",
        "name": "Hyderabad"
      },
      "mandal": {
        "id": "mandal_secunderabad",
        "name": "Secunderabad"
      },
      "designation": {
        "name": "Mandal Reporter",
        "nativeName": "మండల రిపోర్టర్"
      }
    }
  },
  "tenant": {
    "id": "cmk7e7tg401ezlp22wkz5rxky",
    "name": "Kaburlu News",
    "slug": "kaburlu-news"
  },
  "language": {
    "id": "lang_telugu",
    "name": "Telugu",
    "code": "te"
  },
  "categories": [
    {
      "id": "cat123",
      "name": "Breaking News",
      "slug": "breaking-news"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized` - No valid token
- `403 Forbidden` - Access denied (tenant mismatch or not own article)
- `404 Not Found` - Article doesn't exist

---

## Priority Levels

- **1** = High priority (breaking news, important stories)
- **2** = Medium priority (regular news)
- **3** = Low priority (fillers, less urgent content) - **default**

---

## Location Hierarchy Behavior

### State Filter
When you filter by `stateId`, you get articles from:
- Reporters assigned to that state directly
- Reporters assigned to any district in that state
- Reporters assigned to any mandal in any district in that state

### District Filter
When you filter by `districtId`, you get articles from:
- Reporters assigned to that district directly
- Reporters assigned to any mandal in that district

### Mandal Filter
When you filter by `mandalId`, you get articles from:
- Only reporters assigned to that specific mandal

---

## Database Migration Required

Before using these APIs, run the migration to add the `priority` field:

```bash
cd ~/kaburlu_media_backend
npx prisma migrate deploy
pm2 restart kaburlu-api
```

This adds:
- `priority Int @default(3)` to Article model
- Index on priority field for fast queries

---

## Use Cases

### Super Admin Dashboard
```javascript
// Get all breaking news from all tenants today
fetch('/api/v1/articles/list/superadmin?priority=1&page=1&limit=100')

// Monitor specific tenant's activity
fetch('/api/v1/articles/list/superadmin?tenantId=XXX&date=2026-02-05')

// Find long-form articles (investigative journalism)
fetch('/api/v1/articles/list/superadmin?minChars=2000')
```

### Tenant Admin Dashboard
```javascript
// Get today's articles by priority
fetch('/api/v1/articles/list/tenant?priority=1')
fetch('/api/v1/articles/list/tenant?priority=2')

// Monitor specific district coverage
fetch('/api/v1/articles/list/tenant?districtId=XXX')

// Get reporter's daily output
fetch('/api/v1/articles/list/tenant?reporterId=YYY&date=2026-02-05')
```

### Reporter Dashboard
```javascript
// My today's work
fetch('/api/v1/articles/list/reporter')

// Check quota compliance (with quota API)
const quota = await fetch('/api/v1/reporter/article-quota')
const articles = await fetch('/api/v1/articles/list/reporter?priority=1')
// Show: "You've posted 3/5 high-priority articles today"

// Review past work
fetch('/api/v1/articles/list/reporter?date=2026-02-01')
```

---

## Notes

- Date filter defaults to **today** (current UTC date) if not specified
- Character count is calculated from the `content` field length
- Results are ordered by `createdAt DESC` (newest first)
- Maximum 200 items per page for performance
- Location filters only work if reporter has location assignment in their profile
- Response always includes `characterCount` for each article
