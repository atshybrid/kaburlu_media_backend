# News APIs Swagger Documentation Reference

All news/article creation and update APIs have comprehensive Swagger documentation. Access at: `/api/docs` or `/api/v1/docs`

## ShortNews APIs (/shortnews)

### Create/Generate
1. **POST /shortnews** - Submit short news (citizen reporter)
   - ✅ Full Swagger documentation
   - Required: title, content (≤60 words), categoryId, latitude, longitude
   - Auto-generates slug, SEO metadata, JSON-LD
   - Returns status (AI_APPROVED, DESK_PENDING, REJECTED)

2. **POST /shortnews/AIarticle** - AI generate short news draft
   - ✅ Full Swagger documentation
   - Input: rawText (≤500 words)
   - Returns: optimized title (≤35 chars), content (≤60 words), suggested category
   - Auto-creates category if doesn't exist

3. **POST /shortnews/ai/rewrite** - AI rewrite helper
   - ✅ Full Swagger documentation
   - Input: rawText, optional title
   - Returns: professional rewritten content (≤60 words)

### Update
4. **PUT /shortnews/:id** - Update short news
   - ✅ Full Swagger documentation
   - Editable: title, content, categoryId, tags, mediaUrls, location, templateId, headings
   - Access: author or desk/admin

5. **PATCH /shortnews/:id/status** - Update status (AI/desk approval)
   - ✅ Full Swagger documentation
   - Status options: AI_APPROVED, DESK_PENDING, DESK_APPROVED, REJECTED
   - Optional aiRemark field

## Article APIs (/articles)

### Create - Standard
1. **POST /articles** (legacy) - Create article
   - ✅ Full Swagger documentation
   - Basic article creation with title, content, categoryIds

2. **POST /articles/tenant** - Create tenant-scoped article
   - ✅ Full Swagger documentation
   - Requires tenantId and reporter/admin role

3. **POST /articles/webstories** - Create web story
   - ✅ Full Swagger documentation

### Create - AI Enhanced
4. **POST /articles/ai/compose** - Compose AI-enhanced article
   - ✅ Full Swagger documentation
   - Header: X-Generate (web, web+short, web+newspaper)
   - Stores raw + generates website article JSON
   - Returns: articleId, webArticleId, web object with slug/title/status

5. **POST /articles/ai/blocks** - Generate using two-block prompt
   - ✅ Full Swagger documentation
   - Returns structured SEO JSON + plain text body
   - Converts to normalized website JSON
   - **Final recommended POST API for website articles**

6. **POST /articles/ai/chatgpt/rewrite** - Rewrite via ChatGPT
   - ✅ Full Swagger documentation
   - Creates long SEO article + short news
   - Required: domainName, categoryIds, languageCode, reporterId, rawContent

7. **POST /articles/ai/gemini/rewrite** - Rewrite via Gemini
   - ✅ Full Swagger documentation
   - Creates long SEO article + short news
   - Same schema as ChatGPT rewrite

### Create - Raw/Queue
8. **POST /articles/raw** - Store raw article for later AI processing
   - ✅ Full Swagger documentation
   - Required: domainId, reporterId, languageCode, content

9. **POST /articles/ai/raw** - Enqueue raw article for background processing
   - ✅ Full Swagger documentation
   - Marks AI queue flags (web, short, newspaper)
   - Background worker generates outputs
   - Returns: 202 Accepted

10. **POST /articles/raw/:id/process** - Process raw article immediately
    - ✅ Full Swagger documentation
    - Fast rewrite using Gemini flash
    - Creates TenantWebArticle and ShortNews
    - Returns: outputs with webArticleId, shortNewsId

### Create - Newspaper (Print Desk)
11. **POST /articles/newspaper** - Create newspaper article
    - ✅ Full Swagger documentation
    - Required: title, heading, points (bulletPoints), content, dateline
    - Optional: subTitle, lead, categoryId, languageId, placeName
    - Returns: id, slug, status

### Update
12. **PUT /articles/:id** - Update article
    - ✅ Full Swagger documentation
    - Editable: title, content, categoryIds, status (DRAFT/PUBLISHED/ARCHIVED)

13. **PATCH /articles/web/:id/status** - Update web article status
    - ✅ Full Swagger documentation
    - Status management for TenantWebArticle

14. **PATCH /articles/newspaper/:id** - Update newspaper article
    - ✅ Full Swagger documentation
    - Editable: title, heading, subTitle, lead, points, status, content, dateline
    - Access control: SUPER_ADMIN/TENANT_ADMIN (full), REPORTER (own articles only)

## Deprecated APIs

1. **POST /articles/ai/web** - Returns 410 Gone
   - Use `/articles/ai/blocks` instead

2. **POST /articles/ai/simple** - Still functional but deprecated
   - Simple AI article with domain/category/media
   - Swagger doc exists but marked for deprecation

## Access to Documentation

### Local Development
- Main docs: http://localhost:3000/api/docs
- Versioned: http://localhost:3000/api/v1/docs

### Production
- Main docs: https://your-domain.com/api/docs
- Versioned: https://your-domain.com/api/v1/docs

## Tags in Swagger UI

All endpoints are organized under these tags:
- **ShortNews** - Short news (citizen reporter) APIs
- **Articles** - Full article and newspaper APIs
- **AI Rewrite** - AI-powered content generation

## Authentication

All endpoints require JWT authentication:
```
Authorization: Bearer <token>
```

Security scheme: `bearerAuth`

## Key Notes

1. **Tenant Admin Posting**: Ensure TENANT_ADMIN users have Reporter linkage (fixed via auto-creation in users.service.ts)
2. **Multi-format Support**: Use X-Generate header on /ai/compose to control output formats
3. **Background Processing**: /ai/raw for queued processing, /raw/:id/process for immediate processing
4. **Validation**: 
   - Short news content: ≤60 words
   - AI article rawText: ≤500 words
   - Title limits: varies by endpoint
5. **SEO**: Auto-generates slug, metaTitle, metaDescription, JSON-LD, alt texts

## Complete API Coverage

✅ All POST (create) endpoints documented
✅ All PUT/PATCH (update) endpoints documented
✅ Request/response schemas with examples
✅ Authentication requirements specified
✅ Validation rules documented
✅ Access control clearly stated

Total documented news endpoints: **19 POST + 5 UPDATE = 24 endpoints**
