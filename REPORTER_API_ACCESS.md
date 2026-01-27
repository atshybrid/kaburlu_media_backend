# Reporter API Access Guide

## Authentication
All reporter APIs require JWT Bearer token:
```
Authorization: Bearer <your-jwt-token>
```

## ✅ APIs Available to REPORTER Role

### 1. AI Rewrite API (Primary Newsroom Flow)

#### POST /api/v1/ai/rewrite/unified
**Purpose:** Generate print + web + mobile articles from raw text using AI

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

**Request:**
```json
{
  "rawText": "Reporter's original text in Telugu/English",
  "categories": ["Crime", "Accident"],
  "newspaperName": "Kaburlu",
  "language": {
    "code": "te",
    "name": "Telugu",
    "script": "Telugu"
  }
}
```

**Response:**
```json
{
  "print_article": {
    "headline": "AI generated headline",
    "subheadline": "...",
    "body": ["paragraph1", "paragraph2"]
  },
  "web_article": {
    "title": "SEO optimized title",
    "content": "HTML content"
  },
  "short_mobile_article": {
    "title": "Short title",
    "content": "≤60 words"
  },
  "images": {
    "required_count": 2,
    "descriptions": ["image1", "image2"],
    "captions": ["caption1", "caption2"]
  },
  "internal_evidence": {
    "required": true,
    "items": ["evidence1", "evidence2"]
  },
  "status": {
    "publish_ready": true
  }
}
```

---

### 2. Unified Article Creation (All 3 Types Together)

#### POST /api/v1/articles/unified
**Purpose:** Create Newspaper + Web + ShortNews in ONE transaction

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN, EDITOR roles

**Tenant Resolution:**
- REPORTER: Uses tenantId from reporter profile (automatic)
- TENANT_ADMIN: Can specify tenantId or use assigned tenant
- SUPER_ADMIN: MUST provide tenantId

**Status Logic for REPORTER:**
- autoPublish=true + publishReady=true → PUBLISHED
- autoPublish=true + publishReady=false → PENDING
- autoPublish=false → PENDING

**Request:**
```json
{
  "tenantId": "auto-resolved for reporters",
  "baseArticle": {
    "languageCode": "te"
  },
  "location": {
    "resolved": {
      "stateId": "...",
      "districtId": "..."
    }
  },
  "printArticle": {
    "headline": "Print headline",
    "body": ["paragraph1", "paragraph2"]
  },
  "webArticle": {
    "title": "Web title",
    "content": "<p>HTML content</p>"
  },
  "shortNews": {
    "title": "Mobile title",
    "content": "Short content"
  },
  "images": {
    "featured": "https://...",
    "gallery": ["url1", "url2"]
  },
  "publishReady": true,
  "autoPublish": true
}
```

#### GET /api/v1/articles/unified
**Purpose:** List all unified articles

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

**Query Params:**
- `tenantId` - Filter by tenant
- `status` - PENDING, PUBLISHED, ARCHIVED
- `page`, `limit` - Pagination

#### GET /api/v1/articles/unified/:id
**Purpose:** Get single unified article

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### PATCH /api/v1/articles/unified/:id
**Purpose:** Update unified article

**Access:** ✅ REPORTER (own articles), TENANT_ADMIN, SUPER_ADMIN

---

### 3. Newspaper Articles (Print/ePaper)

#### POST /api/v1/articles/newspaper
**Purpose:** Create newspaper article for print/ePaper

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### GET /api/v1/articles/newspaper
**Purpose:** List newspaper articles

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### GET /api/v1/articles/newspaper/:id
**Purpose:** Get single newspaper article

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### PATCH /api/v1/articles/newspaper/:id
**Purpose:** Update newspaper article

**Access:** ✅ REPORTER (own articles), TENANT_ADMIN, SUPER_ADMIN

#### DELETE /api/v1/articles/newspaper/:id
**Purpose:** Delete newspaper article

**Access:** ✅ REPORTER (own articles), TENANT_ADMIN, SUPER_ADMIN

---

### 4. Web Articles (CMS)

#### PATCH /api/v1/articles/web/:id/status
**Purpose:** Update web article status

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

---

### 5. Raw Articles & AI Processing

#### POST /api/v1/articles/raw
**Purpose:** Create raw article (before AI processing)

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### GET /api/v1/articles/raw/:id
**Purpose:** Get raw article status

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### POST /api/v1/articles/ai/raw
**Purpose:** Enqueue raw article for AI processing

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### POST /api/v1/articles/raw/:id/process
**Purpose:** Process raw article immediately (no queue)

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### GET /api/v1/articles/queue/pending
**Purpose:** Get pending AI processing jobs

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

---

### 6. AI Composition Tools

#### POST /api/v1/articles/ai/compose
**Purpose:** AI article composition

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### POST /api/v1/articles/ai/blocks
**Purpose:** Generate article blocks with AI

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### POST /api/v1/articles/ai/chatgpt/rewrite
**Purpose:** Rewrite with ChatGPT

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### POST /api/v1/articles/ai/gemini/rewrite
**Purpose:** Rewrite with Gemini

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

---

### 7. Article Management

#### GET /api/v1/articles/:id/ai-status
**Purpose:** Get AI processing status for article

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

#### PUT /api/v1/articles/:id
**Purpose:** Update article

**Access:** ✅ REPORTER (own articles), TENANT_ADMIN, SUPER_ADMIN

#### DELETE /api/v1/articles/:id
**Purpose:** Delete article

**Access:** ✅ REPORTER (own articles), TENANT_ADMIN, SUPER_ADMIN

---

### 8. Categories

#### GET /api/v1/categories/tenant
**Purpose:** Get categories for tenant

**Access:** ✅ REPORTER, TENANT_ADMIN, SUPER_ADMIN

---

### 9. Reporter Profile & ID Card

#### GET /api/v1/tenants/:tenantId/reporters/:id/id-card
**Purpose:** Get reporter's ID card details

**Access:** ✅ Public (no auth required)

**Response:**
```json
{
  "id": "card-id",
  "reporterId": "reporter-id",
  "cardNumber": "ID000001",
  "issuedAt": "2026-01-27T...",
  "expiresAt": "2027-01-27T...",
  "pdfUrl": "https://..."
}
```

#### POST /api/v1/tenants/:tenantId/reporters/:id/id-card
**Purpose:** Generate ID card (requires profile photo + payments)

**Access:** ✅ TENANT_ADMIN, SUPER_ADMIN only

**Prerequisites:**
- Profile photo uploaded
- Onboarding payment completed (if idCardCharge > 0)
- Subscription payment completed (if subscriptionActive=true)

---

### 10. Reporter KYC

#### POST /api/v1/tenants/:tenantId/reporters/:id/kyc
**Purpose:** Submit KYC documents

**Access:** ✅ REPORTER (own profile), TENANT_ADMIN, SUPER_ADMIN

**Request:**
```json
{
  "aadharNumberMasked": "XXXX XXXX 1234",
  "panNumberMasked": "ABCDE1234F",
  "workProofUrl": "https://..."
}
```

---

## 🔒 Admin-Only APIs (Not Available to REPORTER)

### Reporter Management
- POST /api/v1/tenants/:tenantId/reporters (Create reporter) - TENANT_ADMIN only
- PATCH /api/v1/tenants/:tenantId/reporters/:id/subscription (Toggle subscription) - TENANT_ADMIN only
- POST /api/v1/tenants/:tenantId/reporters/:id/id-card (Generate ID card) - TENANT_ADMIN only

---

## Recommended Reporter Workflow

### Standard Article Creation Flow:

1. **AI Rewrite** (Optional but recommended)
   ```
   POST /api/v1/ai/rewrite/unified
   → Get print_article, web_article, short_mobile_article
   ```

2. **Create Unified Article**
   ```
   POST /api/v1/articles/unified
   → Creates all 3 types atomically
   → Status auto-set based on autoPublish flag
   ```

3. **Check Status**
   ```
   GET /api/v1/articles/unified/:id
   → Verify article was created
   ```

### Alternative: Direct Newspaper Article

1. **Create Newspaper Article**
   ```
   POST /api/v1/articles/newspaper
   → For print/ePaper only
   ```

2. **Update if needed**
   ```
   PATCH /api/v1/articles/newspaper/:id
   → Edit before publish
   ```

---

## Error Handling

### Common Errors for REPORTER:

**403 Forbidden**
- Trying to access/edit articles from other reporters
- Trying to access admin-only endpoints

**500 Internal Server Error**
```json
{
  "error": "REPORTER role missing. Seed roles."
}
```
**Solution:** Contact admin - database roles need to be seeded

**401 Unauthorized**
- JWT token missing or expired
- Role not properly assigned to user

---

## Testing Reporter APIs

### Get Your Reporter ID:
```bash
# Login first to get JWT token
curl -X POST http://localhost:3001/api/v1/auth/reporter/login \
  -H 'Content-Type: application/json' \
  -d '{
    "mobileNumber": "1234567890",
    "mpin": "1234"
  }'

# Response includes reporterId
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "user-id",
    "reporterId": "reporter-id"  <-- Use this
  }
}
```

### Test AI Rewrite:
```bash
curl -X POST http://localhost:3001/api/v1/ai/rewrite/unified \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "rawText": "Your raw article text",
    "categories": ["Crime"]
  }'
```

### Test Article Creation:
```bash
curl -X POST http://localhost:3001/api/v1/articles/unified \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d @article-payload.json
```

### Get Your ID Card:
```bash
curl http://localhost:3001/api/v1/tenants/TENANT_ID/reporters/REPORTER_ID/id-card
```

---

## Summary

✅ **REPORTER has full access to:**
- AI rewrite APIs
- Article creation (unified, newspaper, web)
- Article editing (own articles only)
- Categories listing
- ID card viewing
- KYC submission

❌ **REPORTER cannot:**
- Create other reporters
- Manage subscriptions
- Generate ID cards
- Approve/publish articles (unless autoPublish=true)
- Access other reporters' data
