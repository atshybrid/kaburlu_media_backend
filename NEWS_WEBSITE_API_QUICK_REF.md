# \ud83d\ude80 News Website API 2.0 - Quick Reference

## \ud83c\udfaf New Endpoints

### 1. GET /api/public/config
**Consolidates:** `/theme`, `/languages`, settings from `/epaper/verify-domain`

```bash
curl https://news.kaburlu.com/api/public/config
```

**Response:**
```json
{
  "tenant": { "id": "...", "slug": "kaburlu", "name": "Kaburlu Media" },
  "branding": {
    "logoUrl": "https://...",
    "primaryColor": "#e91e63",
    "siteName": "Kaburlu News"
  },
  "seo": {
    "meta": { "title": "...", "description": "..." },
    "openGraph": { ... },
    "twitter": { ... }
  },
  "content": {
    "defaultLanguage": "te",
    "languages": [
      { "code": "te", "name": "Telugu", "defaultForTenant": true }
    ]
  },
  "integrations": {
    "analytics": { "googleAnalyticsId": "...", "gtmId": "..." },
    "ads": { "adsenseClientId": "..." }
  }
}
```

### 2. GET /api/public/seo/homepage
**New:** Homepage Schema.org structured data

```bash
curl https://news.kaburlu.com/api/public/seo/homepage
```

**Response:**
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "url": "https://news.kaburlu.com",
      "name": "Kaburlu News",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://news.kaburlu.com/search?q={search_term_string}"
      }
    },
    {
      "@type": "Organization",
      "name": "Kaburlu News",
      "logo": "https://...",
      "sameAs": ["https://facebook.com/...", "https://twitter.com/..."]
    }
  ]
}
```

---

## \u2705 Enhanced Endpoints

### GET /api/public/articles
**Added:** `totalPages` in response

```bash
curl 'https://news.kaburlu.com/api/public/articles?page=1&pageSize=20&categorySlug=politics'
```

**Response:**
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 157,
  "totalPages": 8,  // \u2b50 NEW!
  "items": [...]
}
```

### GET /api/public/articles/:slug
**Added:** `?includeRelated=true` for related articles

```bash
curl 'https://news.kaburlu.com/api/public/articles/breaking-news?includeRelated=true'
```

**Response:**
```json
{
  "id": "...",
  "title": "Breaking News",
  "...": "...",
  "related": {  // \u2b50 NEW!
    "sameCategory": [...],  // Same category articles
    "sameTags": [...]       // Similar tags articles
  }
}
```

---

## \u26a0\ufe0f Deprecated Endpoints

### All return deprecation headers:
- `X-Deprecated-Endpoint`: Replacement suggestion
- `X-Deprecation-Date: 2026-02-24`

| Old Endpoint | Use Instead |
|---|---|
| `GET /theme` | `GET /config` |
| `GET /languages` | `GET /config` |
| `GET /articles/latest` | `GET /articles/home` |
| `GET /articles/by-category/:slug` | `GET /articles?categorySlug=:slug` |

---

## \ud83d\udcca Performance Impact

### Homepage Load (Before vs After)

**Before:**
```javascript
// 5+ API calls
Promise.all([
  fetch('/api/public/theme'),
  fetch('/api/public/languages'),
  fetch('/api/public/categories'),
  fetch('/api/public/articles/home'),
  fetch('/api/public/epaper/verify-domain')
])
```

**After:**
```javascript
// 2 API calls (60% reduction!)
Promise.all([
  fetch('/api/public/config'),
  fetch('/api/public/articles/home?shape=homepage')
])
```

---

## \ud83d\udccb Swagger Documentation

All endpoints now organized under clean tags:
- **News Website API 2.0** - Optimized core endpoints
- **\u26a0\ufe0f Deprecated** - Old endpoints (will be removed 2026-02-24)
- **EPF ePaper - Public** - ePaper-specific (unchanged)

Access at: `https://app.kaburlumedia.com/api/docs`

---

## \ud83d\udc68\u200d\ud83d\udcbb Frontend Integration

### Next.js App Router Example

```typescript
// app/layout.tsx
export async function generateMetadata() {
  const config = await fetch('/api/public/config', {
    next: { revalidate: 3600 } // Cache 1 hour
  }).then(r => r.json())
  
  return {
    title: config.seo.meta.title,
    description: config.seo.meta.description
  }
}

// app/page.tsx
export default async function HomePage() {
  const [config, articles, seo] = await Promise.all([
    fetch('/api/public/config'),
    fetch('/api/public/articles/home?shape=homepage&lang=te'),
    fetch('/api/public/seo/homepage')
  ])
  
  return (
    <>
      <script 
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(seo) }}
      />
      <Hero articles={articles.hero} />
      {articles.sections.map(section => (
        <Section key={section.key} {...section} />
      ))}
    </>
  )
}

// app/articles/[slug]/page.tsx
export default async function ArticlePage({ params }) {
  const article = await fetch(
    `/api/public/articles/${params.slug}?includeRelated=true`
  )
  
  return (
    <>
      <ArticleContent {...article} />
      {article.related && (
        <RelatedArticles articles={article.related.sameCategory} />
      )}
    </>
  )
}
```

---

## \u2705 Migration Checklist

- [ ] Update homepage to use `/config`
- [ ] Add homepage SEO schema from `/seo/homepage`
- [ ] Use `totalPages` for pagination UI
- [ ] Enable `?includeRelated=true` on article detail pages
- [ ] Remove calls to deprecated endpoints
- [ ] Update ISR/SSG cache strategies
- [ ] Test on staging domain
- [ ] Monitor deprecation headers in production

---

## \ud83d\udcde Support

- Full docs: `NEWS_WEBSITE_API_V2.md`
- Swagger: `/api/docs`
- Issues: Check console for deprecation warnings
