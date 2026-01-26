# News/Article APIs - Complete Swagger Documentation

## Summary
All news and article-related APIs are now fully documented in Swagger with proper tags, descriptions, and organization. The API documentation is accessible at `/api/docs` when the server is running.

---

## Swagger Tags Added/Updated

### 1. **News Room**
**Description:** Unified article creation and reporter article management - Create 3-in-1 articles (Newspaper, Web, ShortNews) with AI support

**Endpoints:**
- `POST /articles/unified` - Create unified article (all 3 types in one transaction)
- `PUT /articles/unified/:id` - Update unified article
- `DELETE /articles/unified/:id` - Delete unified article
- `GET /reporters/:reporterId/articles` - Get reporter's articles
- `GET /reporters/:reporterId/articles/:id` - Get specific reporter article
- `POST /ai/unified/headline` - AI headline generation
- `POST /ai/unified/rewrite` - AI content rewrite

**Key Features:**
- 3-in-1 article creation (NewspaperArticle + TenantWebArticle + ShortNews)
- Dateline format: "Place, Tenant Native Name, Date"
- AI-powered content generation
- Reporter-scoped article management

---

### 2. **Articles**
**Description:** Legacy article CRUD endpoints - Read, update, and delete articles

**Endpoints:**
- `GET /articles` - List all articles with filters
- `GET /articles/:id` - Get article by ID
- `PUT /articles/:id` - Update article
- `DELETE /articles/:id` - Delete article
- `PATCH /articles/:id/status` - Update article status
- `GET /articles/:id/related` - Get related articles
- `GET /articles/:id/comments` - Get article comments
- `POST /articles/:id/comments` - Add comment to article
- And 15+ more article management endpoints

---

### 3. **ShortNews**
**Description:** Short news CRUD endpoints - Quick news snippets with location and metadata

**Endpoints:**
- `POST /shortnews` - Create short news
- `GET /shortnews` - List short news with pagination/filters
- `GET /shortnews/:id` - Get short news by ID
- `PUT /shortnews/:id` - Update short news
- `DELETE /shortnews/:id` - Delete short news
- `PATCH /shortnews/:id/status` - Update status
- `POST /shortnews/bulk-update` - Bulk status update
- `GET /shortnews/by-ids` - Get multiple by IDs

**Features:**
- Location-based news snippets
- Status management (draft, published, archived)
- Bulk operations
- Reporter attribution

---

### 4. **ShortNews Options**
**Description:** Short news dropdown options - Categories, statuses, and configuration

**Endpoints:**
- `GET /shortnews-options/categories` - Available categories
- `GET /shortnews-options/statuses` - Available statuses
- `GET /shortnews-options/types` - News types
- `POST /shortnews-options/categories` - Create category
- `PUT /shortnews-options/categories/:id` - Update category
- `DELETE /shortnews-options/categories/:id` - Delete category

---

### 5. **Dashboard**
**Description:** Tenant admin and reporter dashboard endpoints - Statistics, top news, activity feed

**Endpoints:**
- `GET /tenants/:tenantId/dashboard/stats` - Tenant statistics
- `GET /tenants/:tenantId/dashboard/today-top-news` - Today's top performing news
- `GET /tenants/:tenantId/dashboard/activity` - Recent activity feed
- `GET /tenants/:tenantId/dashboard/reporters/:reporterId/stats` - Reporter statistics
- `GET /tenants/:tenantId/dashboard/reporters/:reporterId/today-top-news` - Reporter's top news today
- And 10+ more dashboard analytics endpoints

**Features:**
- Article counts by status
- View counts and engagement metrics
- Today's top news with reporter details
- Activity timeline
- Reporter performance tracking

---

### 6. **Engagement - Read Tracking**
**Description:** Article and ShortNews read progress tracking with time spent and scroll depth

**Endpoints:**
- `POST /articles/read/simple/mark` - Mark article as read
- `POST /articles/read` - Track article read (deprecated)
- `GET /articles/read/:articleId` - Get read status (deprecated)
- `POST /shortnews/read/progress` - Track ShortNews read progress
- `GET /shortnews/read/status/multi` - Batch read status check

**Features:**
- Time spent tracking
- Scroll depth percentage
- Read completion status
- Batch status queries

---

### 7. **Engagement - Comments**
**Description:** Article comments CRUD - Create, edit, delete, and moderate comments

**Endpoints:**
- `GET /comments/articles/:articleId` - Get comments for article
- `POST /comments` - Create comment
- `PUT /comments/:id` - Update comment
- `DELETE /comments/:id` - Delete comment
- `POST /articles/:id/comments` - Add comment (legacy)

**Features:**
- Nested/threaded comments
- User attribution
- Moderation support
- Edit/delete permissions

---

### 8. **Public - Website**
**Description:** Website-facing public APIs for theme, categories, articles, navigation, homepage, SEO

**News-Related Endpoints:**
- `GET /public/website/articles` - Public article listing
- `GET /public/website/articles/:id` - Public article detail
- `GET /public/website/shortnews` - Public short news listing
- `GET /public/website/categories/:slug/articles` - Articles by category
- `GET /public/website/homepage` - Homepage articles/sections
- `GET /public/website/latest-news` - Latest news feed

**Features:**
- Multi-tenant filtering by domain
- SEO-optimized responses
- Category-based organization
- Homepage layouts (Style1, Style2)

---

## API Access Patterns

### Authentication
Most news/article management endpoints require JWT authentication:
```javascript
headers: {
  'Authorization': 'Bearer <JWT_TOKEN>'
}
```

### Multi-Tenancy
Public APIs use domain-based tenant resolution:
```javascript
headers: {
  'Host': 'yourdomain.com',
  // OR for local testing:
  'X-Tenant-Domain': 'yourdomain.com'
}
```

### Role-Based Access
- **SUPER_ADMIN**: Full access to all endpoints
- **TENANT_ADMIN**: Tenant-scoped article/news management
- **REPORTER**: Create/edit own articles, view own stats
- **DESK_EDITOR**: Review and publish content
- **Public**: Read-only access to published content

---

## Unified Article Creation Example

```javascript
POST /articles/unified
Content-Type: application/json
Authorization: Bearer <token>

{
  "baseArticle": {
    "category": "Politics",
    "locationId": "district-123",
    "publisherId": "reporter-456"
  },
  "newspaperArticle": {
    "title": "విజయవాడలో కొత్త అభివృద్ధి ప్రాజెక్టులు",
    "content": "Full newspaper article content...",
    "dateline": "విజయవాడ, కబుర్లు టుడే, జనవరి 26",
    "pageNo": 1
  },
  "webArticle": {
    "headline": "New Development Projects in Vijayawada",
    "summary": "Brief web summary...",
    "content": "Full web article content...",
    "images": ["url1", "url2"]
  },
  "shortNews": {
    "content": "Quick news snippet (max 500 chars)...",
    "category": "Breaking",
    "tags": ["విజయవాడ", "అభివృద్ధి"]
  }
}
```

---

## Dashboard Today's Top News Example

```javascript
GET /tenants/tenant-123/dashboard/today-top-news
Authorization: Bearer <tenant-admin-token>

Response:
{
  "date": "2025-01-26",
  "tenant": {
    "id": "tenant-123",
    "name": "Kaburlu",
    "nativeName": "కబుర్లు",
    "logo": "https://..."
  },
  "topNews": [
    {
      "rank": 1,
      "article": {
        "id": "article-789",
        "title": "Breaking News Title",
        "views": 15420,
        "category": "Politics"
      },
      "reporter": {
        "id": "reporter-456",
        "name": "రాజేష్ కుమార్",
        "designation": "సీనియర్ రిపోర్టర్",
        "location": "విజయవాడ"
      }
    }
    // ... more top news
  ]
}
```

---

## Access Swagger Documentation

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open Swagger UI in browser:
   ```
   http://localhost:3001/api/docs
   ```

3. Or access versioned docs:
   ```
   http://localhost:3001/api/v1/docs
   ```

---

## Tags Organization in Swagger UI

Swagger UI groups all endpoints by these tags in this order:

1. **News Room** - Unified article creation and AI features
2. **Articles** - Legacy article management  
3. **Dashboard** - Statistics and top news
4. **ShortNews** - Short news CRUD
5. **ShortNews Options** - Configuration
6. **Engagement - Read Tracking** - Read progress
7. **Engagement - Comments** - Comments system
8. **Public - Website** - Public news APIs

All news-related endpoints are now easy to find and test via Swagger UI.

---

## Next Steps

### For Frontend Integration:
1. Review Swagger docs at `/api/docs`
2. Test endpoints using "Try it out" in Swagger UI
3. Copy request/response examples
4. Implement API clients based on documented schemas

### For Backend Development:
1. All new news/article endpoints should use appropriate tags
2. Follow existing JSDoc Swagger annotation patterns
3. Include request/response examples
4. Document authentication requirements

---

## Files Modified

- **src/lib/swagger.ts** - Added missing tags: "News Room", "Dashboard", "Engagement", "Engagement - Read Tracking", "Engagement - Comments"
- All article/news route files already had complete Swagger documentation

---

## Build Status

✅ All changes compiled successfully  
✅ No TypeScript errors  
✅ Swagger docs generated successfully  
✅ All news API tags registered and visible

Server is ready for production deployment.
