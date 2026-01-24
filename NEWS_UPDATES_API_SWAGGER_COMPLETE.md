# News & Updates APIs - Complete Swagger Documentation

**Status:** ✅ Complete  
**Last Updated:** January 2025  
**Swagger Access:** `/api/docs` or `/api/v1/docs`

---

## Overview

All news and updates related APIs are now fully documented with comprehensive Swagger/OpenAPI 3.0 documentation. This includes:

- Request parameters with examples
- Response schemas with real data examples
- Use case descriptions
- Cache strategy recommendations
- Frontend integration guidance

---

## 📰 News Website API 2.0 Endpoints

All endpoints are tagged with **"News Website API 2.0"** in Swagger UI for easy discovery.

### 1. **Website Configuration** (NEW)
```
GET /api/public/config
```

**Purpose:** Consolidated endpoint for all website configuration  
**Replaces:** `/theme`, `/languages`, and various config endpoints  

**Features:**
- Branding (logo, name, colors)
- SEO metadata
- Available languages
- Theme configuration
- Integration URLs (ads, analytics, AMP, PWA)
- Navigation structure
- Social media links

**Swagger Status:** ✅ Complete  
**Cache:** ISR 3600s (1 hour) or on-demand  
**Use Cases:** App initialization, metadata tags, navigation rendering

---

### 2. **SEO Homepage Schema** (NEW)
```
GET /api/public/seo/homepage
```

**Purpose:** Google-compliant JSON-LD structured data for homepage  

**Features:**
- NewsMediaOrganization schema
- Publisher information
- Contact details
- Social profiles
- Logo & branding

**Swagger Status:** ✅ Complete  
**Cache:** Static or 86400s (24 hours)  
**Use Cases:** Homepage `<script type="application/ld+json">`, Google News compliance

---

### 3. **Article Listing with Pagination**
```
GET /api/public/articles
```

**Purpose:** Paginated list of published news articles with filtering  

**Features:**
- Domain-scoped article filtering
- Category filtering (`?categorySlug=politics`)
- Language filtering (`?languageCode=te`)
- Pagination with `totalPages` support
- Returns article cards with excerpt, cover image, category, tags

**Query Parameters:**
- `page` (default: 1)
- `pageSize` (default: 20, max: 100)
- `categorySlug` (optional)
- `languageCode` (optional)

**Response:**
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 150,
  "totalPages": 8,
  "items": [
    {
      "id": "wa_1",
      "slug": "sangareddy-patancheru-december-27",
      "title": "Headline",
      "excerpt": "Short summary...",
      "coverImageUrl": "https://cdn.example.com/cover.webp",
      "publishedAt": "2025-12-27T10:00:00.000Z",
      "category": { "id": "cat_1", "slug": "politics", "name": "రాజకీయాలు" },
      "languageCode": "te",
      "tags": ["breaking", "telangana"]
    }
  ]
}
```

**Swagger Status:** ✅ Complete  
**Cache:** ISR 60-300s  
**Use Cases:** Category pages, search results, archive pages, language-specific feeds

---

### 4. **Homepage Articles with Sections**
```
GET /api/public/articles/home
```

**Purpose:** Homepage article layout with hero, top stories, and custom sections  

**Features:**
- Hero article(s) for above-the-fold
- Top stories section
- Section-wise article grouping (politics, sports, entertainment, etc.)
- Theme-driven layout (style1, style2)
- Language filtering

**Query Parameters:**
- `limit` (default: 30, max: 100) - for flat shape
- `shape` - `flat` (default) or `homepage` (section-wise)
- `themeKey` (default: style1)
- `lang` - language code filter

**Response (shape=homepage):**
```json
{
  "hero": [/* hero articles */],
  "topStories": [/* top stories */],
  "sections": [
    {
      "key": "politics",
      "title": "Politics",
      "position": 10,
      "limit": 6,
      "categorySlug": "politics",
      "items": [/* articles */]
    }
  ],
  "data": {
    "politics": [/* articles */],
    "sports": [/* articles */]
  },
  "config": {
    "heroCount": 1,
    "topStoriesCount": 5,
    "themeKey": "style1",
    "lang": "te"
  }
}
```

**Swagger Status:** ✅ Complete  
**Cache:** ISR 60-180s  
**Use Cases:** Homepage rendering, above-the-fold content, section-based layouts

---

### 5. **Article Detail with SEO & Related Articles**
```
GET /api/public/articles/:slug
```

**Purpose:** Complete article detail with full content, SEO data, and optional related articles  

**Features:**
- Full article content (blocks/HTML)
- Auto-generated NewsArticle JSON-LD schema
- SEO metadata (title, description, OG tags)
- Related articles via `?includeRelated=true`
- Breadcrumb data
- Author information
- Reading time calculation
- View count tracking (async)

**Query Parameters:**
- `languageCode` (optional) - for multi-locale slug disambiguation
- `includeRelated` (default: false) - fetch related articles

**JSON-LD Features:**
- Merges stored and auto-generated schema
- Includes publisher Organization
- Proper article section mapping
- OG image fallbacks (WebP + JPEG)

**Swagger Status:** ✅ Complete  
**Cache:** ISR 60s or on-demand revalidation  
**Use Cases:** Article detail pages, AMP pages, social media preview, RSS/Feed

---

### 6. **Categories with Translations**
```
GET /api/public/categories
```

**Purpose:** Domain-allowed news categories with multi-language support  

**Features:**
- Domain-scoped category list
- Multi-language translations
- Parent-child category relationships
- Category icons/images
- Slug-based routing support

**Translation Logic:**
- Uses `languageCode` query param
- Falls back to tenant default language
- Returns both original and translated names

**Swagger Status:** ✅ Complete  
**Cache:** ISR 3600s (1 hour)  
**Use Cases:** Navigation menu, category filter dropdowns, sitemap, breadcrumbs

---

### 7. **Web Stories (Mobile-First)**
```
GET /api/public/stories
```

**Purpose:** Google Web Stories format for mobile-optimized news  

**Features:**
- Mobile-optimized story cards
- Poster images for thumbnails
- Sorted by latest published
- Domain-scoped filtering

**Swagger Status:** ✅ Complete  
**Cache:** ISR 300s (5 minutes)  
**Use Cases:** Mobile story carousel, AMP stories feed, Instagram-style news

---

### 8. **PRGI/Entity Legal Information**
```
GET /api/public/entity
```

**Purpose:** Publication registration and legal information  

**Includes:**
- PRGI registration number
- Publication title and periodicity
- Owner, publisher, editor details
- Publication and printing location
- Registered address

**Swagger Status:** ✅ Complete  
**Cache:** ISR 86400s (24 hours)  
**Use Cases:** Footer legal info, about page, regulatory compliance, contact info

---

### 9. **Tenant by Domain**
```
GET /api/public/tenants/by-domain/:domain
```

**Purpose:** Resolve tenant information by domain name  

**Note:** Rarely needed by frontend (tenant context auto-resolved via middleware)

**Swagger Status:** ✅ Complete  
**Cache:** Static or long-lived  
**Use Cases:** External API integrations, domain verification, admin dashboards

---

## ⚠️ Deprecated Endpoints

These endpoints are marked as **deprecated** in Swagger with warnings:

### `/api/public/theme`
**Deprecated:** Use `/api/public/config` instead  
**Deprecation Date:** 2025-01-01  
**Sunset Date:** 2025-06-30

### `/api/public/languages`
**Deprecated:** Use `/api/public/config` instead  
**Deprecation Date:** 2025-01-01  
**Sunset Date:** 2025-06-30

### `/api/public/articles/latest`
**Deprecated:** Use `/api/public/articles?page=1&pageSize=20` instead  
**Deprecation Date:** 2025-01-01  
**Sunset Date:** 2025-06-30

### `/api/public/articles/by-category/:slug`
**Deprecated:** Use `/api/public/articles?categorySlug=:slug` instead  
**Deprecation Date:** 2025-01-01  
**Sunset Date:** 2025-06-30

All deprecated endpoints return these headers:
```
X-Deprecated-Endpoint: true
X-Deprecation-Date: 2025-01-01
X-Sunset-Date: 2025-06-30
X-Replacement-Endpoint: <new-endpoint>
```

---

## 📄 EPF ePaper APIs

Separate from News Website APIs, these are documented under **"EPF ePaper - Public"** tag:

- `GET /api/public/epaper/ticker` - Breaking news ticker for ePaper site
- `GET /api/public/epaper/issues` - ePaper issue listing
- `GET /api/public/epaper/issues/:id` - ePaper issue detail with pages

---

## 🔍 Swagger UI Access

### Production
```
https://your-domain.com/api/docs
https://your-domain.com/api/v1/docs
```

### Local Development
```
http://localhost:3000/api/docs
http://localhost:3000/api/v1/docs
```

### Swagger Tags Organization

All endpoints are organized with clear tags:
- **News Website API 2.0** - Primary news/updates APIs
- **⚠️ Deprecated** - Legacy endpoints with migration path
- **EPF ePaper - Public** - ePaper-specific endpoints

---

## 📚 Frontend Integration Examples

### Next.js App Router (TypeScript)

#### Homepage with Sections
```typescript
// app/page.tsx
import { Metadata } from 'next';

interface HomePageData {
  hero: ArticleCard[];
  topStories: ArticleCard[];
  sections: Section[];
  config: HomeConfig;
}

async function getHomepageData(): Promise<HomePageData> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const domain = process.env.NEXT_PUBLIC_DOMAIN;
  
  const res = await fetch(
    `${baseUrl}/public/articles/home?shape=homepage&themeKey=style1`,
    {
      headers: { 'X-Tenant-Domain': domain },
      next: { revalidate: 60 } // ISR 60s
    }
  );
  
  if (!res.ok) throw new Error('Failed to fetch homepage data');
  return res.json();
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/public/config`,
    { headers: { 'X-Tenant-Domain': process.env.NEXT_PUBLIC_DOMAIN } }
  ).then(res => res.json());
  
  return {
    title: config.branding.tagline || config.branding.name,
    description: config.seo.description,
    openGraph: {
      images: [config.branding.logo.url]
    }
  };
}

export default async function HomePage() {
  const data = await getHomepageData();
  
  return (
    <>
      <HeroSection articles={data.hero} />
      <TopStories articles={data.topStories} />
      {data.sections.map(section => (
        <Section key={section.key} {...section} />
      ))}
    </>
  );
}
```

#### Article Detail Page
```typescript
// app/articles/[slug]/page.tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

async function getArticle(slug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const domain = process.env.NEXT_PUBLIC_DOMAIN;
  
  const res = await fetch(
    `${baseUrl}/public/articles/${encodeURIComponent(slug)}?includeRelated=true`,
    {
      headers: { 'X-Tenant-Domain': domain },
      next: { revalidate: 60 }
    }
  );
  
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ 
  params 
}: { 
  params: { slug: string } 
}): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article) return {};
  
  return {
    title: article.meta?.seoTitle || article.title,
    description: article.meta?.metaDescription || article.excerpt,
    openGraph: {
      images: [article.coverImage?.url],
      type: 'article',
      publishedTime: article.publishedAt,
    }
  };
}

export default async function ArticlePage({ 
  params 
}: { 
  params: { slug: string } 
}) {
  const article = await getArticle(params.slug);
  if (!article) notFound();
  
  return (
    <article>
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(article.jsonLd)
        }}
      />
      
      <h1>{article.title}</h1>
      <img src={article.coverImage.url} alt={article.coverImage.alt} />
      <div dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
      
      {/* Related Articles */}
      {article.related && (
        <aside>
          <h2>Related Articles</h2>
          {article.related.map(rel => (
            <ArticleCard key={rel.id} {...rel} />
          ))}
        </aside>
      )}
    </article>
  );
}
```

#### Category Page
```typescript
// app/categories/[slug]/page.tsx
interface CategoryPageProps {
  params: { slug: string };
  searchParams: { page?: string };
}

async function getCategoryArticles(slug: string, page: number) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const domain = process.env.NEXT_PUBLIC_DOMAIN;
  
  const res = await fetch(
    `${baseUrl}/public/articles?categorySlug=${slug}&page=${page}&pageSize=20`,
    {
      headers: { 'X-Tenant-Domain': domain },
      next: { revalidate: 180 }
    }
  );
  
  if (!res.ok) throw new Error('Failed to fetch articles');
  return res.json();
}

export default async function CategoryPage({ 
  params, 
  searchParams 
}: CategoryPageProps) {
  const page = parseInt(searchParams.page || '1', 10);
  const data = await getCategoryArticles(params.slug, page);
  
  return (
    <>
      <h1>Category: {params.slug}</h1>
      <ArticleGrid articles={data.items} />
      <Pagination 
        currentPage={data.page} 
        totalPages={data.totalPages} 
      />
    </>
  );
}
```

---

## 🚀 Performance Recommendations

### Cache Strategy by Endpoint

| Endpoint | Cache Strategy | Revalidate | Use Case |
|----------|---------------|------------|----------|
| `/config` | ISR | 3600s (1h) | App init, static config |
| `/seo/homepage` | Static | 86400s (24h) | Homepage schema |
| `/articles` | ISR | 60-300s | Listing pages |
| `/articles/home` | ISR | 60-180s | Homepage |
| `/articles/:slug` | ISR + On-demand | 60s | Article pages |
| `/categories` | ISR | 3600s (1h) | Navigation |
| `/stories` | ISR | 300s (5m) | Stories carousel |
| `/entity` | Static | 86400s (24h) | Footer legal |

### Next.js ISR Configuration
```typescript
// Use in fetch options
{
  next: {
    revalidate: 60, // seconds
    tags: ['articles', 'homepage'] // for on-demand revalidation
  }
}
```

### On-Demand Revalidation
```typescript
// When article is published/updated
import { revalidateTag, revalidatePath } from 'next/cache';

// In API route or Server Action
revalidateTag('articles');
revalidatePath(`/articles/${article.slug}`);
```

---

## ✅ Migration Checklist

If migrating from old APIs to News Website API 2.0:

- [ ] Replace `/theme` and `/languages` with `/config`
- [ ] Update `/articles/latest` to `/articles?page=1&pageSize=20`
- [ ] Update `/articles/by-category/:slug` to `/articles?categorySlug=:slug`
- [ ] Add `totalPages` support to pagination UI
- [ ] Add `?includeRelated=true` to article detail pages
- [ ] Update cache strategies per recommendations
- [ ] Test multi-domain tenant scenarios
- [ ] Update TypeScript types for new response schemas
- [ ] Remove deprecated endpoint usage before sunset date (2025-06-30)

---

## 📝 Summary

**Total News/Updates APIs:** 9 core endpoints  
**Swagger Documentation:** ✅ 100% Complete  
**Deprecated Endpoints:** 4 (with clear migration path)  
**Cache Optimized:** ✅ Yes (ISR + Static)  
**Frontend Examples:** ✅ Next.js TypeScript  
**Multi-tenant Support:** ✅ Full domain-based resolution

All endpoints are production-ready with comprehensive Swagger documentation accessible at `/api/docs`.

---

**Last Updated:** January 2025  
**Documentation Version:** 2.0  
**API Base:** `/api/public`
