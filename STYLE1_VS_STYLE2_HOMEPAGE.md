# Style1 vs Style2 Homepage API Response

## API Endpoint
`GET /public/homepage/smart`

The API **auto-detects** the theme style from `DomainSettings.data.themeStyle` and returns the appropriate response structure.

---

## STYLE1 Response Structure
**Total Articles: ~50-60**

### Response Format
```json
{
  "config": {
    "themeStyle": "style1",
    "detectedFromDomain": "kaburlutoday.com",
    "sortBy": "publishedAt"
  },
  "seo": {
    "title": "Site Title",
    "description": "Site Description",
    "ogImageUrl": "...",
    "ogUrl": "...",
    "jsonLd": {...}
  },
  "sections": [
    {
      "id": "auto-ticker",
      "key": "ticker",
      "name": "Flash Ticker",
      "visible": true,
      "limit": 12,
      "articles": [12 articles - publishedAt DESC]
    },
    {
      "id": "auto-hero",
      "key": "hero",
      "name": "Hero Section",
      "visible": true,
      "totalArticles": 26,
      "columns": [
        {
          "key": "heroMain",
          "position": 1,
          "name": "Hero Main",
          "limit": 6,
          "articles": [6 articles - publishedAt DESC]
        },
        {
          "key": "heroLatest",
          "position": 2,
          "name": "Latest News",
          "limit": 8,
          "articles": [8 articles - publishedAt DESC]
        },
        {
          "key": "heroMustRead",
          "position": 3,
          "name": "Must Read",
          "limit": 8,
          "articles": [8 articles - viewCount DESC]
        },
        {
          "key": "heroTop",
          "position": 4,
          "name": "Top Articles",
          "limit": 4,
          "articles": [4 articles - viewCount + publishedAt DESC]
        }
      ]
    },
    {
      "id": "auto-categories",
      "key": "categories",
      "name": "Category Columns",
      "visible": true,
      "categoriesShown": 4,
      "maxCategories": 4,
      "articlesPerCategory": 5,
      "totalArticles": 20,
      "categories": [
        {
          "slug": "national",
          "name": "NATIONAL",
          "visible": true,
          "articlesLimit": 5,
          "articles": [up to 5 articles]
        },
        // ... up to 4 categories total (STRICT limit)
      ]
    },
    {
      "id": "auto-hgblock",
      "key": "hgBlock",
      "name": "HG Block",
      "visible": true,
      "categoriesShown": 2,
      "maxCategories": 2,
      "articlesPerCategory": 5,
      "totalArticles": 10,
      "categories": [
        // 2 categories × 5 articles each
      ]
    },
    {
      "id": "auto-webstories",
      "key": "webStories",
      "name": "Web Stories",
      "visible": true,
      "optional": true,
      "totalArticles": 8,
      "categories": [
        // 1 category × 8 articles (only shows if available)
      ]
    }
  ],
  "meta": {
    "timestamp": "2026-02-06T...",
    "totalSections": 5,
    "visibleSections": 5
  }
}
```

### Style1 Sections Breakdown
| Section | Key | Articles | Description |
|---------|-----|----------|-------------|
| **Flash Ticker** | `ticker` | 12 | Latest breaking news (publishedAt DESC) |
| **Hero Section** | `hero` | 26 | 4 columns with different sorting |
| ↳ Hero Main | `heroMain` | 6 | Latest hero content (publishedAt DESC) |
| ↳ Latest News | `heroLatest` | 8 | Latest news (publishedAt DESC) |
| ↳ Must Read | `heroMustRead` | 8 | Most viewed (viewCount DESC) |
| ↳ Top Articles | `heroTop` | 4 | Trending (viewCount + publishedAt DESC) |
| **Category Columns** | `categories` | ~20 | 4 categories × 5 articles (STRICT) |
| **HG Block** | `hgBlock` | ~10 | 2 categories × 5 articles |
| **Web Stories** | `webStories` | ~8 | 1 category × 8 articles (optional) |
| **TOTAL** | | **~50-60** | |

---

## STYLE2 Response Structure (TOI-style Magazine Layout)
**Total Articles: ~100+**

### Response Format
```json
{
  "version": "2.0-smart-style2",
  "themeStyle": "style2",
  "timestamp": "2026-02-06T...",
  
  "flashTicker": {
    "visible": true,
    "items": [10 breaking news items]
  },
  
  "heroSection": {
    "visible": true,
    "layout": "toi-grid-3",
    "columns": {
      "leftRail": {
        "label": "వార్తల్లో",
        "articles": [10 articles]
      },
      "centerLead": {
        "hero": {article object},
        "medium": [2 articles],
        "small": [6 articles]
      },
      "rightRail": {
        "latest": {
          "label": "తాజా వార్తలు",
          "articles": [6 articles]
        },
        "mostRead": {
          "label": "ఎక్కువగా చదివినవి",
          "articles": [5 articles]
        }
      }
    }
  },
  
  "adLeaderboard1": {
    "visible": true,
    "slot": "homepage_leaderboard_1"
  },
  
  "categoryColumns": {
    "visible": true,
    "label": "వార్తా విభాగాలు",
    "columnsPerRow": 3,
    "categories": [
      // 6 main categories × 5 articles = 30 articles
    ]
  },
  
  "magazineGrid": {
    "visible": true,
    "style": "magazine-grid",
    "color": "emerald",
    "categoryName": "ENTERTAINMENT",
    "categorySlug": "entertainment",
    "articles": [6 articles],
    "articlesCount": 6
  },
  
  "horizontalCards": {
    "visible": true,
    "style": "horizontal-cards",
    "color": "rose",
    "categoryName": "SPORTS",
    "articles": [6 articles]
  },
  
  "spotlight": {
    "visible": true,
    "style": "spotlight",
    "color": "amber",
    "articles": [6 articles]
  },
  
  "newspaperColumns": {
    "visible": true,
    "style": "newspaper-columns",
    "color": "blue",
    "articles": [6 articles]
  },
  
  "extraMagazineGrid": {
    "visible": true,
    "style": "magazine-grid",
    "color": "violet",
    "articles": [6 articles]
  },
  
  "extraHorizontalCards": {
    "visible": true,
    "style": "horizontal-cards",
    "color": "cyan",
    "articles": [6 articles]
  },
  
  "photoGallery": {
    "visible": true,
    "style": "photo-gallery",
    "color": "slate",
    "articles": [6 articles]
  },
  
  "timeline": {
    "visible": true,
    "style": "timeline",
    "color": "gray",
    "articles": [6 articles]
  },
  
  "adHorizontal1": {
    "visible": true,
    "slot": "homepage_horizontal_1"
  },
  
  "featuredBanner": {
    "visible": true,
    "article": {single featured article}
  },
  
  "compactLists": {
    "visible": true,
    "sections": [
      // 2 categories × 6 articles each = 12 articles
    ]
  },
  
  "adFooter": {
    "visible": true,
    "slots": ["homepage_footer_1", "homepage_footer_2", "homepage_footer_3"]
  },
  
  "meta": {
    "totalArticles": 100,
    "totalCategories": 16,
    "mainCategoriesCount": 6,
    "styledSectionsCount": 8,
    "lastUpdated": "2026-02-06T...",
    "cacheAge": 180
  }
}
```

### Style2 Sections Breakdown
| Section | Articles | Description |
|---------|----------|-------------|
| **Flash Ticker** | 10 | Breaking news ticker |
| **Hero Section** | 30 | TOI-style 3-column grid |
| ↳ Left Rail | 10 | "వార్తల్లో" (In The News) |
| ↳ Center Lead | 9 | 1 hero + 2 medium + 6 small cards |
| ↳ Right Rail | 11 | Latest (6) + Most Read (5) |
| **Category Columns** | 30 | 6 main categories × 5 articles |
| **Magazine Grid** | 6 | Emerald colored grid layout |
| **Horizontal Cards** | 6 | Rose colored horizontal layout |
| **Spotlight** | 6 | Amber colored spotlight section |
| **Newspaper Columns** | 6 | Blue colored newspaper-style |
| **Extra Magazine Grid** | 6 | Violet colored grid |
| **Extra Horizontal Cards** | 6 | Cyan colored horizontal |
| **Photo Gallery** | 6 | Slate colored gallery |
| **Timeline** | 6 | Gray colored timeline |
| **Featured Banner** | 1 | Single featured article |
| **Compact Lists** | 12 | 2 categories × 6 articles |
| **Ad Slots** | - | Leaderboard, Horizontal, Footer (3) |
| **TOTAL** | **~100+** | Full magazine-style layout |

---

## Key Differences

### Style1 (Simple Theme)
- ✅ Clean, minimalist structure
- ✅ 5 main sections
- ✅ ~50-60 total articles
- ✅ STRICT category limits (4, 2, 1)
- ✅ Hero with 4 columns (different sorting per column)
- ✅ Array-based `sections` structure
- ✅ Optimized for fast loading
- ✅ Best for: Regional news sites, simple layouts

### Style2 (TOI Magazine Layout)
- ✅ Rich, magazine-style layout
- ✅ 15+ styled sections
- ✅ ~100+ total articles
- ✅ 16 categories total (6 main + 8 styled + 2 compact)
- ✅ Hero with 3-column TOI-style grid
- ✅ Object-based sections (direct property access)
- ✅ Multiple ad slots integrated
- ✅ 8 different visual styles (magazine-grid, horizontal-cards, spotlight, etc.)
- ✅ Best for: National news portals, content-heavy sites

---

## How to Switch Themes

### Method 1: Update Domain Settings (Recommended)
```sql
-- Update themeStyle in DomainSettings
UPDATE "DomainSettings" 
SET data = jsonb_set(data, '{themeStyle}', '"style2"', true)
WHERE "domainId" = 'your-domain-id';
```

### Method 2: Update Tenant Theme
```sql
-- Update TenantTheme
UPDATE "TenantTheme"
SET "homepageConfig" = jsonb_set("homepageConfig", '{themeStyle}', '"style2"', true)
WHERE "tenantId" = 'your-tenant-id';
```

### Method 3: Default Fallback
If neither setting is configured, the API defaults to `style1`.

---

## API Usage Examples

### Get Style1 Homepage
```bash
curl -H "X-Tenant-Domain: kaburlutoday.com" \
  http://localhost:3001/public/homepage/smart
```

### Get Style2 Homepage
```bash
# First update domain settings to use style2
curl -H "X-Tenant-Domain: toidomain.com" \
  http://localhost:3001/public/homepage/smart
```

### With Language Filter
```bash
curl "http://localhost:3001/public/homepage/smart?lang=te" \
  -H "X-Tenant-Domain: kaburlutoday.com"
```

### With Custom Sorting
```bash
curl "http://localhost:3001/public/homepage/smart?sortBy=viewCount" \
  -H "X-Tenant-Domain: kaburlutoday.com"
```

---

## Performance Notes

### Style1
- **Response Size**: ~14-20 KB (card data only)
- **Database Queries**: ~10-15 queries
- **Load Time**: <200ms (optimized)
- **Cache TTL**: 180 seconds (recommended)
- **ISR/SSG**: Excellent support

### Style2
- **Response Size**: ~40-60 KB (more sections)
- **Database Queries**: ~25-30 queries
- **Load Time**: <500ms
- **Cache TTL**: 180 seconds (recommended)
- **ISR/SSG**: Good support

---

## Article Card Format (Both Styles)
```json
{
  "id": "article-id",
  "slug": "article-slug",
  "title": "Article Title",
  "coverImageUrl": "https://...",
  "publishedAt": "2026-02-06T...",
  "viewCount": 123,
  "category": {
    "id": "category-id",
    "slug": "category-slug",
    "name": "Category Name"
  }
}
```

**Note:** Both styles return **card data only** (no `contentJson`, `tags`, or full article body) for optimal performance.

---

## Swagger Documentation
View complete API documentation at:
- **Local**: http://localhost:3001/api/docs
- **Production**: https://your-domain.com/api/docs

Search for "News Website API 2.0" tag to find the smart homepage endpoint.

---

## Summary

- **Same API endpoint** (`/public/homepage/smart`) serves both themes
- **Auto-detection** based on domain settings
- **Style1**: Simple, fast, ~50-60 articles
- **Style2**: Rich, magazine-style, ~100+ articles
- **Both optimized** for performance with card-only data
- **Fully documented** in Swagger with examples
