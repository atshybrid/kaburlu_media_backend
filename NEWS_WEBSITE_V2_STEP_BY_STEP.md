# News Website APIs - Complete Step by Step Guide

## 🎯 Overview

This guide shows the **complete flow** for building a multi-tenant Telugu news website frontend.

**Base URL:** `https://app.kaburlumedia.com/api/v1`  
**Header:** `X-Tenant-Domain: telangana.kaburlu.com`

---

## 📦 Version 2.0 APIs (Recommended)

### Key Benefits of V2.0
- ✅ **Single config endpoint** - All settings in one call
- ✅ **Better performance** - Fewer API calls needed
- ✅ **Feature flags** - Enable/disable features per tenant
- ✅ **Multi-language** - Built-in language support
- ✅ **Cache hints** - Optimal caching recommendations
- ✅ **SEO optimized** - JSON-LD, sitemaps, robots.txt

### 📋 V2.0 Endpoints Summary

| API | Purpose | Cache TTL | When to Call |
|-----|---------|-----------|--------------|
| `GET /public/config` | Complete website configuration | 1 hour | App initialization |
| `GET /public/smart-homepage` | **⚡ SMART** - Latest + Most Read + Sections (All-in-One) | 3 minutes | Homepage (optimized) |
| `GET /public/homepage` | Style-based homepage sections (Style1/Style2) | 5 minutes | Homepage content |
| `GET /public/seo/homepage` | Homepage SEO JSON-LD | 1 hour | Homepage SEO |

**New in V2.0:**
- ⚡ **`/public/smart-homepage`** - Ultra-fast single API call for complete homepage data
- 🎨 **`/public/homepage`** - Auto-detects theme style from domain settings

### 🔄 Legacy APIs (Still Available)

| API | Purpose | Cache TTL | When to Call |
|-----|---------|-----------|--------------|
| `GET /public/categories` | Categories list | 1 hour | Navigation, filters |
| `GET /public/articles` | Articles listing | 5 minutes | Homepage, category pages |
| `GET /public/articles/:slug` | Single article | 10 minutes | Article detail page |
| `GET /public/homepage` | Homepage sections | 5 minutes | Homepage (style-based) |
| `GET /public/sitemap.xml` | XML sitemap | 24 hours | SEO crawlers |
| `GET /public/robots.txt` | Robots file | 24 hours | SEO crawlers |

---

## 🚀 Version 2.0 Implementation

---

### **V2.0 API #1: Website Configuration**

**Endpoint:** `GET /public/config`  
**Purpose:** Get complete website configuration in single call  
**Cache:** 1 hour (ISR)  
**When:** App initialization, layout rendering

```bash
GET /public/config
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Response:**
```json
{
  "version": "2.0",
  "timestamp": "2026-01-25T10:30:00.000Z",
  "tenant": {
    "id": "cm123",
    "slug": "telangana-kaburlu",
    "name": "Telangana Kaburlu",
    "displayName": "తెలంగాణ కబుర్లు",
    "nativeName": "తెలంగాణ కబుర్లు",
    "timezone": "Asia/Kolkata",
    "locale": "te"
  },
  "domain": {
    "id": "dom_123",
    "domain": "telangana.kaburlu.com",
    "baseUrl": "https://telangana.kaburlu.com",
    "kind": "WEBSITE",
    "status": "ACTIVE",
    "environment": "production"
  },
  "branding": {
    "siteName": "తెలంగాణ కబుర్లు",
    "siteTagline": "తెలంగాణ వార్తలు",
    "logo": "https://cdn.kaburlu.com/logos/telangana.png",
    "favicon": "https://cdn.kaburlu.com/favicons/telangana.ico",
    "appleTouchIcon": "https://cdn.kaburlu.com/icons/apple-touch.png"
  },
  "theme": {
    "colors": {
      "primary": "#d32f2f",
      "secondary": "#1976d2",
      "headerBg": "#ffffff",
      "footerBg": "#212121"
    },
    "typography": {
      "fontFamily": "Noto Sans Telugu, system-ui",
      "fontFamilyHeadings": "Tiro Telugu, serif"
    },
    "layout": {
      "style": "style2",
      "containerWidth": 1280
    }
  },
  "content": {
    "defaultLanguage": "te",
    "supportedLanguages": ["te", "en"],
    "languages": [
      {
        "code": "te",
        "name": "Telugu",
        "nativeName": "తెలుగు",
        "direction": "ltr",
        "defaultForTenant": true
      }
    ]
  },
  "features": {
    "darkMode": true,
    "pwaPushNotifications": true,
    "commenting": false,
    "bookmarking": true,
    "sharing": true,
    "liveUpdates": true,
    "newsletter": true,
    "ePaper": true,
    "mobileApp": true
  },
  "navigation": {
    "header": {
      "primaryMenu": [
        { "label": "హోం", "href": "/", "icon": null },
        { "label": "తాజావార్తలు", "href": "/latest", "icon": null },
        { "label": "రాజకీయాలు", "href": "/category/politics", "icon": null }
      ],
      "showSearch": true,
      "showLanguageSwitcher": true,
      "sticky": { "enabled": true, "offsetPx": 80 }
    },
    "footer": {
      "sections": [
        {
          "title": "గురించి",
          "links": [
            { "label": "మా గురించి", "href": "/about-us" },
            { "label": "సంప్రదించండి", "href": "/contact-us" }
          ]
        }
      ],
      "copyrightText": "© 2026 తెలంగాణ కబుర్లు",
      "showSocialLinks": true
    }
  },
  "social": {
    "facebook": "https://facebook.com/telanganakaburlu",
    "twitter": "https://twitter.com/telanganakaburlu",
    "youtube": "https://youtube.com/@telanganakaburlu"
  },
  "integrations": {
    "analytics": {
      "googleAnalytics": "G-XXXXXXXXXX",
      "enabled": true
    },
    "ads": {
      "adsense": "ca-pub-123456",
      "enabled": true
    }
  },
  "cacheControl": {
    "config": 3600,
    "homepage": 300,
    "article": 600
  }
}
```

**Frontend Usage:**
```typescript
// Next.js App Router - app/layout.tsx
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

export async function generateMetadata() {
  const config = await getConfig();
  return {
    title: config.branding.siteName,
    description: config.seo.meta.description,
    icons: { icon: config.branding.favicon }
  };
}

async function getConfig() {
  const res = await fetch(`${API_BASE}/public/config`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 3600 } // Cache 1 hour
  });
  return res.json();
}
```

---

### **V2.0 API #2: Smart Homepage (All-in-One) ⚡**

**Endpoint:** `GET /public/smart-homepage`  
**Purpose:** Ultra-fast single API call for complete homepage data  
**Cache:** 3 minutes (ISR)  
**When:** Homepage (preferred over multiple API calls)

**Why Use This?**
- ✅ **Single API call** - Get everything in one request
- ✅ **Minimal payload** - Only essential fields for fast loading
- ✅ **Smart linking** - Auto-categorized articles
- ✅ **Response size < 50KB** - Instant mobile loading
- ✅ **Parallel data fetching** - Maximum server performance

**Query Parameters:**
```bash
# Default (10 latest, 5 most read, 6 sections with 4 articles each)
GET /public/smart-homepage
Header: X-Tenant-Domain: telangana.kaburlu.com

# Custom counts
GET /public/smart-homepage?latestCount=20&mostReadCount=10&sectionsCount=8&articlesPerSection=5
Header: X-Tenant-Domain: telangana.kaburlu.com

# With language filter
GET /public/smart-homepage?lang=te&latestCount=15
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Parameters:**
- `latestCount` (default: 10, max: 50) - Number of latest articles
- `mostReadCount` (default: 5, max: 20) - Number of trending articles
- `sectionsCount` (default: 6, max: 20) - Number of category sections
- `articlesPerSection` (default: 4, max: 10) - Articles per section
- `lang` (optional) - Language filter (e.g., 'te', 'en')

**Response Structure:**
```json
{
  "version": "2.0-smart",
  "timestamp": "2026-01-25T10:30:00.000Z",
  
  "latestNews": [
    {
      "id": "art_001",
      "title": "హైదరాబాద్ మెట్రో విస్తరణ పనులు వేగవంతం",
      "slug": "hyderabad-metro-expansion-speeds-up",
      "excerpt": "హైదరాబాద్‌లో మెట్రో రైలు విస్తరణ పనులు వేగంగా జరుగుతున్నాయి...",
      "imageUrl": "https://cdn.kaburlu.com/articles/metro-expansion.jpg",
      "categoryId": "cat_telangana",
      "categoryName": "తెలంగాణ",
      "categorySlug": "telangana",
      "publishedAt": "2026-01-25T10:00:00.000Z",
      "readTime": 3
    },
    {
      "id": "art_002",
      "title": "రాష్ట్రంలో అధిక వర్షాలు",
      "slug": "heavy-rains-in-state",
      "excerpt": "తెలంగాణలో రాబోయే మూడు రోజుల పాటు అధిక వర్షాల సూచన...",
      "imageUrl": "https://cdn.kaburlu.com/articles/heavy-rains.jpg",
      "categoryId": "cat_weather",
      "categoryName": "వాతావరణం",
      "categorySlug": "weather",
      "publishedAt": "2026-01-25T09:45:00.000Z",
      "readTime": 2
    }
  ],
  
  "mostRead": [
    {
      "id": "art_100",
      "title": "రాజకీయాల్లో కీలక మార్పులు",
      "slug": "key-political-changes",
      "imageUrl": "https://cdn.kaburlu.com/articles/politics-changes.jpg",
      "categoryName": "రాజకీయాలు",
      "publishedAt": "2026-01-24T15:00:00.000Z",
      "viewCount": 15420
    },
    {
      "id": "art_101",
      "title": "క్రికెట్ మ్యాచ్‌లో థ్రిల్లింగ్ ఫినిష్",
      "slug": "cricket-thrilling-finish",
      "imageUrl": "https://cdn.kaburlu.com/articles/cricket-match.jpg",
      "categoryName": "క్రీడలు",
      "publishedAt": "2026-01-24T18:30:00.000Z",
      "viewCount": 12850
    }
  ],
  
  "sections": [
    {
      "categoryId": "cat_telangana",
      "categoryName": "తెలంగాణ",
      "categorySlug": "telangana",
      "categoryIcon": "🏛️",
      "articlesCount": 245,
      "articles": [
        {
          "id": "art_201",
          "title": "హైదరాబాద్‌లో కొత్త IT పార్క్ ప్రారంభం",
          "slug": "new-it-park-hyderabad",
          "excerpt": "హైదరాబాద్ నగరంలో అత్యాధునిక IT పార్క్ ఉద్ఘాటన...",
          "imageUrl": "https://cdn.kaburlu.com/articles/it-park.jpg",
          "publishedAt": "2026-01-25T09:00:00.000Z",
          "isBreaking": false
        },
        {
          "id": "art_202",
          "title": "నగరంలో ట్రాఫిక్ నియంత్రణకు కొత్త చర్యలు",
          "slug": "traffic-control-measures",
          "excerpt": "హైదరాబాద్ ట్రాఫిక్ పోలీసులు కొత్త నియమాలను అమలు చేయనున్నారు...",
          "imageUrl": "https://cdn.kaburlu.com/articles/traffic-control.jpg",
          "publishedAt": "2026-01-25T08:30:00.000Z",
          "isBreaking": true
        }
      ]
    },
    {
      "categoryId": "cat_politics",
      "categoryName": "రాజకీయాలు",
      "categorySlug": "politics",
      "categoryIcon": "⚖️",
      "articlesCount": 189,
      "articles": [
        {
          "id": "art_301",
          "title": "అసెంబ్లీ సమావేశాల షెడ్యూల్ ప్రకటన",
          "slug": "assembly-sessions-schedule",
          "excerpt": "రాష్ట్ర శాసనసభ సమావేశాల షెడ్యూల్ అధికారికంగా ప్రకటించారు...",
          "imageUrl": "https://cdn.kaburlu.com/articles/assembly-schedule.jpg",
          "publishedAt": "2026-01-25T07:45:00.000Z",
          "isBreaking": false
        }
      ]
    },
    {
      "categoryId": "cat_sports",
      "categoryName": "క్రీడలు",
      "categorySlug": "sports",
      "categoryIcon": "🏆",
      "articlesCount": 156,
      "articles": [
        {
          "id": "art_401",
          "title": "భారత జట్టు పాకిస్తాన్‌ను ఓడించింది",
          "slug": "india-defeats-pakistan",
          "excerpt": "టీ20 ప్రపంచ కప్‌లో భారత్ పాకిస్తాన్‌పై గెలుపొందింది...",
          "imageUrl": "https://cdn.kaburlu.com/articles/india-pakistan.jpg",
          "publishedAt": "2026-01-24T20:30:00.000Z",
          "isBreaking": false
        }
      ]
    },
    {
      "categoryId": "cat_entertainment",
      "categoryName": "వినోదం",
      "categorySlug": "entertainment",
      "categoryIcon": "🎬",
      "articlesCount": 134,
      "articles": [
        {
          "id": "art_501",
          "title": "కొత్త తెలుగు సినిమా ట్రైలర్ రిలీజ్",
          "slug": "new-telugu-movie-trailer",
          "excerpt": "మెగా స్టార్ కొత్త చిత్రం ట్రైలర్ సోషల్ మీడియాలో వైరల్...",
          "imageUrl": "https://cdn.kaburlu.com/articles/movie-trailer.jpg",
          "publishedAt": "2026-01-24T16:00:00.000Z",
          "isBreaking": false
        }
      ]
    },
    {
      "categoryId": "cat_business",
      "categoryName": "వ్యాపారం",
      "categorySlug": "business",
      "categoryIcon": "💼",
      "articlesCount": 98,
      "articles": [
        {
          "id": "art_601",
          "title": "స్టాక్ మార్కెట్‌లో భారీ ఎగుడుదిగుడు",
          "slug": "stock-market-volatility",
          "excerpt": "ఈ రోజు స్టాక్ మార్కెట్‌లో భారీ హెచ్చు తగ్గులు నమోదయ్యాయి...",
          "imageUrl": "https://cdn.kaburlu.com/articles/stock-market.jpg",
          "publishedAt": "2026-01-25T06:30:00.000Z",
          "isBreaking": false
        }
      ]
    },
    {
      "categoryId": "cat_technology",
      "categoryName": "సాంకేతికత",
      "categorySlug": "technology",
      "categoryIcon": "💻",
      "articlesCount": 87,
      "articles": [
        {
          "id": "art_701",
          "title": "కొత్త AI టెక్నాలజీ లాంచ్",
          "slug": "new-ai-technology-launch",
          "excerpt": "భారతీయ కంపెనీ కొత్త AI టెక్నాలజీని ప్రవేశపెట్టింది...",
          "imageUrl": "https://cdn.kaburlu.com/articles/ai-launch.jpg",
          "publishedAt": "2026-01-24T12:00:00.000Z",
          "isBreaking": false
        }
      ]
    }
  ],
  
  "meta": {
    "totalArticles": 1250,
    "totalCategories": 12,
    "lastUpdated": "2026-01-25T10:30:00.000Z",
    "cacheAge": 180
  }
}
```

**Frontend Usage (Next.js):**
```typescript
// app/page.tsx - Smart Homepage
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

export default async function HomePage() {
  const data = await getSmartHomepage();
  
  return (
    <div className="homepage">
      {/* Latest News Section */}
      <section className="latest-news">
        <h2>తాజా వార్తలు</h2>
        <div className="grid">
          {data.latestNews.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      {/* Most Read Sidebar */}
      <aside className="most-read">
        <h3>అత్యధికంగా చదవబడిన వార్తలు</h3>
        {data.mostRead.map(article => (
          <TrendingCard key={article.id} article={article} />
        ))}
      </aside>

      {/* Category Sections */}
      {data.sections.map(section => (
        <section key={section.categoryId} className="category-section">
          <div className="section-header">
            <h2>
              <span className="icon">{section.categoryIcon}</span>
              {section.categoryName}
            </h2>
            <a href={`/category/${section.categorySlug}`}>
              మరిన్ని చూడండి ({section.articlesCount})
            </a>
          </div>
          <div className="articles-grid">
            {section.articles.map(article => (
              <ArticleCard 
                key={article.id} 
                article={article}
                showBreakingBadge={article.isBreaking}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Meta Info */}
      <div className="meta">
        చివరిగా నవీకరించబడింది: {formatTime(data.meta.lastUpdated)}
      </div>
    </div>
  );
}

async function getSmartHomepage() {
  const res = await fetch(
    `${API_BASE}/public/smart-homepage?latestCount=12&mostReadCount=8&sectionsCount=6&articlesPerSection=4`,
    {
      headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
      next: { revalidate: 180 } // Cache 3 minutes
    }
  );
  
  if (!res.ok) throw new Error('Failed to fetch smart homepage');
  return res.json();
}
```

**Performance Benefits:**
```typescript
// ❌ Old approach (5+ API calls)
const [config, categories, latestArticles, trendingArticles, sections] = await Promise.all([
  fetch('/public/config'),
  fetch('/public/categories'),
  fetch('/public/articles?limit=10'),
  fetch('/public/articles?sortBy=views'),
  fetch('/public/articles?groupBy=category')
]);
// Total: 5 API calls, ~500ms+ total time

// ✅ New approach (1 API call)
const data = await fetch('/public/smart-homepage');
// Total: 1 API call, ~150ms total time
// 3x faster! 🚀
```

**Mobile Optimization:**
```typescript
// For mobile apps - minimal data transfer
const mobileData = await fetch(
  `${API_BASE}/public/smart-homepage?latestCount=5&mostReadCount=3&sectionsCount=4&articlesPerSection=2`,
  {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN }
  }
);
// Response size: ~15KB (fast 4G/5G loading)
```

---

### **V2.0 API #3: Homepage Sections (Style1 & Style2)**

**Endpoint:** `GET /public/homepage`  
**Purpose:** Get homepage sections with auto-style detection  
**Cache:** 5 minutes  
**When:** Homepage content rendering

**Auto-Detection:** Automatically uses style from domain settings (`themeStyle: 'style1'` or `'style2'`)

**Manual Override:**
- `?shape=style1` - Force Style1 layout
- `?shape=style2` - Force Style2 layout
- `?v=1` - Style1 (legacy parameter)
- `?v=2` - Style2 default
- `?v=3` - Style2 with HomepageSectionConfig table
- `?v=4` - Style2 with theme configuration

```bash
# Auto-detect from domain settings (Recommended)
GET /public/homepage
Header: X-Tenant-Domain: telangana.kaburlu.com

# Force Style1
GET /public/homepage?shape=style1
Header: X-Tenant-Domain: telangana.kaburlu.com

# Force Style2
GET /public/homepage?shape=style2
Header: X-Tenant-Domain: telangana.kaburlu.com

# Style2 with language filter
GET /public/homepage?shape=style2&lang=te
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Response (Style2):**
```json
{
  "style": "style2",
  "sections": [
    {
      "id": 1,
      "position": 1,
      "type": "hero_sidebar",
      "sectionType": "hero_sidebar",
      "categorySlug": "breaking",
      "heroArticles": [
        {
          "id": "art_001",
          "slug": "hyderabad-metro-extension",
          "title": "హైదరాబాద్ మెట్రో విస్తరణకు ఆమోదం",
          "image": "https://cdn.kaburlu.com/articles/metro-001.jpg",
          "excerpt": "హైదరాబాద్ మెట్రో రైలు కొత్త మార్గాలకు...",
          "category": {
            "slug": "politics",
            "name": "రాజకీయాలు"
          },
          "publishedAt": "2026-01-25T08:30:00.000Z"
        }
      ],
      "sidebarArticles": [
        {
          "id": "art_002",
          "title": "మరో ముఖ్య వార్త",
          "slug": "another-news"
        }
      ]
    },
    {
      "id": 2,
      "position": 2,
      "type": "category_boxes_3col",
      "sectionType": "category_boxes_3col",
      "categories": [
        {
          "slug": "politics",
          "name": "రాజకీయాలు",
          "articles": [
            {
              "id": "art_010",
              "title": "రాజకీయ వార్త",
              "image": "https://cdn.kaburlu.com/articles/pol-001.jpg",
              "slug": "political-news"
            }
          ]
        },
        {
          "slug": "sports",
          "name": "క్రీడలు",
          "articles": [
            {
              "id": "art_011",
              "title": "క్రీడా వార్త",
              "image": "https://cdn.kaburlu.com/articles/sports-001.jpg",
              "slug": "sports-news"
            }
          ]
        }
      ]
    },
    {
      "id": 3,
      "position": 3,
      "type": "horizontal_scroll",
      "sectionType": "horizontal_scroll",
      "categorySlug": "entertainment",
      "title": "వినోదం",
      "articles": [
        {
          "id": "art_020",
          "title": "వినోదం వార్త",
          "image": "https://cdn.kaburlu.com/articles/ent-001.jpg",
          "slug": "entertainment-news"
        }
      ]
    }
  ],
  "extras": {
    "trending": [
      {
        "id": "art_050",
        "title": "ట్రెండింగ్ వార్త",
        "slug": "trending-news",
        "views": 5000,
        "image": "https://cdn.kaburlu.com/articles/trend-001.jpg"
      }
    ],
    "mustRead": [
      {
        "id": "art_051",
        "title": "తప్పకుండా చదవండి",
        "slug": "must-read-news"
      }
    ],
    "mostRead": [
      {
        "id": "art_052",
        "title": "అత్యధికంగా చదవబడిన వార్త",
        "slug": "most-read-news"
      }
    ]
  }
}
```

**Response (Style1):**
```json
{
  "version": "1.0",
  "tenant": {
    "id": "cm123",
    "name": "Telangana Kaburlu",
    "slug": "telangana-kaburlu"
  },
  "theme": {
    "primaryColor": "#d32f2f",
    "secondaryColor": "#1976d2",
    "logoUrl": "https://cdn.kaburlu.com/logos/telangana.png"
  },
  "sections": [
    {
      "key": "hero",
      "title": "Breaking News",
      "position": 1,
      "style": "hero",
      "items": [
        {
          "id": "art_001",
          "slug": "breaking-news-today",
          "title": "Breaking News",
          "excerpt": "Latest breaking news...",
          "coverImage": {
            "url": "https://cdn.kaburlu.com/articles/breaking-001.jpg",
            "w": 1200,
            "h": 675
          },
          "publishedAt": "2026-01-25T08:30:00.000Z"
        }
      ]
    },
    {
      "key": "politics",
      "title": "రాజకీయాలు",
      "position": 10,
      "style": "grid",
      "items": [
        {
          "id": "art_010",
          "slug": "political-news",
          "title": "రాజకీయ వార్త",
          "excerpt": "రాజకీయాలపై వివరాలు..."
        }
      ]
    }
  ],
  "data": {
    "heroCount": 1,
    "topStoriesCount": 5
  }
}
```

**Available Section Types (Style2):**
- `hero_sidebar` - Hero article with sidebar
- `category_boxes_3col` - 3-column category boxes
- `horizontal_scroll` - Horizontal scrolling articles
- `magazine_grid` - Magazine-style grid layout
- `video_section` - Video articles section
- `photo_gallery` - Photo gallery section
- `live_blog` - Live updates section
- `opinion_section` - Opinion/editorial articles

**Frontend Usage:**
```typescript
// Auto-detect style from domain config
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

export default async function HomePage() {
  // Get config first to know the style
  const config = await fetch(`${API_BASE}/public/config`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 3600 }
  }).then(r => r.json());
  
  const style = config.theme.layout.style; // 'style1' or 'style2'
  
  // Homepage auto-detects from domain settings
  const homepage = await fetch(`${API_BASE}/public/homepage`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 300 } // 5 minutes
  }).then(r => r.json());
  
  // Or explicitly specify style
  const homepageExplicit = await fetch(
    `${API_BASE}/public/homepage?shape=${style}`,
    {
      headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
      next: { revalidate: 300 }
    }
  ).then(r => r.json());
  
  return (
    <div>
      {homepage.sections.map(section => (
        <DynamicSection key={section.id} section={section} />
      ))}
      
      {/* Trending Sidebar */}
      <aside>
        <h3>ట్రెండింగ్</h3>
        {homepage.extras.trending.map(article => (
          <TrendingCard key={article.id} article={article} />
        ))}
      </aside>
    </div>
  );
}

// Dynamic section renderer
function DynamicSection({ section }) {
  switch (section.sectionType) {
    case 'hero_sidebar':
      return <HeroSidebar {...section} />;
    case 'category_boxes_3col':
      return <CategoryBoxes3Col {...section} />;
    case 'horizontal_scroll':
      return <HorizontalScroll {...section} />;
    case 'magazine_grid':
      return <MagazineGrid {...section} />;
    default:
      return <GenericSection {...section} />;
  }
}
```

**Admin Configuration:**

**Style1 Setup:**
```bash
# Apply default Style1 configuration
POST /api/v1/tenant-theme/{tenantId}/homepage/style1/apply-default
Authorization: Bearer {JWT_TOKEN}

# Customize sections
PATCH /api/v1/tenant-theme/{tenantId}/homepage/style1/sections
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "sections": [
    {
      "key": "politics",
      "title": "రాజకీయాలు",
      "position": 10,
      "categorySlug": "politics",
      "limit": 8
    }
  ]
}
```

**Style2 Setup:**
```bash
# Apply default Style2 configuration
POST /api/v1/tenant-theme/{tenantId}/style2-config/apply-default
Authorization: Bearer {JWT_TOKEN}

# Customize sections
PUT /api/v1/tenant-theme/{tenantId}/style2-config
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "sections": [
    {
      "id": 1,
      "position": 1,
      "section_type": "hero_sidebar",
      "hero_category": "breaking",
      "sidebar_category": "trending"
    },
    {
      "id": 2,
      "position": 2,
      "section_type": "category_boxes_3col",
      "categories": ["politics", "sports", "entertainment"]
    }
  ]
}

# Get available section types
GET /api/v1/tenant-theme/{tenantId}/style2-config/section-types
Authorization: Bearer {JWT_TOKEN}
```

---

### **V2.0 API #4: Homepage SEO**

**Endpoint:** `GET /public/seo/homepage`  
**Purpose:** Get Organization + WebSite JSON-LD schema  
**Cache:** 1 hour  
**When:** Homepage SEO optimization

```bash
GET /public/seo/homepage
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Response:**
```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://telangana.kaburlu.com/#website",
      "url": "https://telangana.kaburlu.com",
      "name": "తెలంగాణ కబుర్లు",
      "description": "తెలంగాణ రాష్ట్రం నుండి తాజా వార్తలు",
      "inLanguage": "te",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://telangana.kaburlu.com/search?q={search_term_string}"
        },
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@type": "Organization",
      "@id": "https://telangana.kaburlu.com/#organization",
      "name": "తెలంగాణ కబుర్లు",
      "url": "https://telangana.kaburlu.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://cdn.kaburlu.com/logos/telangana.png",
        "width": 512,
        "height": 512
      },
      "sameAs": [
        "https://facebook.com/telanganakaburlu",
        "https://twitter.com/telanganakaburlu"
      ]
    }
  ]
}
```

**Frontend Usage:**
```typescript
// app/layout.tsx
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

export default async function RootLayout({ children }) {
  const seo = await fetch(`${API_BASE}/public/seo/homepage`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 3600 }
  }).then(r => r.json());
  
  return (
    <html>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## 📚 Legacy APIs (Existing Endpoints)

---

### **Legacy API #1: Categories**

**Endpoint:** `GET /public/categories`  
**Purpose:** Get categories list with translations  
**Cache:** 1 hour  
**When:** Navigation menu, category pages, filters

```bash
GET /public/categories?languageCode=te
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Response:**
```json
{
  "categories": [
    {
      "id": "cat_1",
      "name": "రాజకీయాలు",
      "slug": "politics",
      "iconUrl": "https://cdn.kaburlu.com/icons/politics.svg",
      "parentId": null,
      "position": 1,
      "articlesCount": 145
    },
    {
      "id": "cat_2",
      "name": "క్రీడలు",
      "slug": "sports",
      "iconUrl": "https://cdn.kaburlu.com/icons/sports.svg",
      "parentId": null,
      "position": 2,
      "articlesCount": 89
    }
  ]
}
```

**Frontend Usage:**
```typescript
// components/Navigation.tsx
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

export async function Navigation() {
  const categories = await getCategories();
  
  return (
    <nav>
      {categories.map(cat => (
        <Link key={cat.id} href={`/category/${cat.slug}`}>
          {cat.name}
        </Link>
      ))}
    </nav>
  );
}
```

---

### **Legacy API #2: Articles Listing**

**Endpoint:** `GET /public/articles`  
**Purpose:** Get paginated articles list with filtering  
**Cache:** 5 minutes  
**When:** Homepage, category pages, latest articles

```bash
GET /public/articles?page=1&pageSize=20&languageCode=te
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `pageSize` - Items per page (default: 20, max: 100)
- `categorySlug` - Filter by category (optional)
- `languageCode` - Language filter (optional)
- `tags` - Comma-separated tags (optional)
- `status` - PUBLISHED (default)

**Response:**
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 342,
  "totalPages": 18,
  "items": [
    {
      "id": "art_001",
      "slug": "hyderabad-metro-extension-approved",
      "title": "హైదరాబాద్ మెట్రో విస్తరణకు ఆమోదం",
      "excerpt": "హైదరాబాద్ మెట్రో రైలు కొత్త మార్గాలకు ప్రభుత్వం ఆమోదం తెలిపింది...",
      "coverImageUrl": "https://cdn.kaburlu.com/articles/metro-001.jpg",
      "publishedAt": "2026-01-25T08:30:00.000Z",
      "author": {
        "id": "rep_001",
        "name": "రామ్ కుమార్",
        "avatar": "https://cdn.kaburlu.com/reporters/ram.jpg"
      },
      "category": {
        "id": "cat_1",
        "name": "రాజకీయాలు",
        "slug": "politics"
      },
      "tags": ["హైదరాబాద్", "మెట్రో", "రవాణా"],
      "views": 1245,
      "commentsCount": 23,
      "readTime": 3
    }
  ]
}
```

**Frontend Usage:**
```typescript
// app/page.tsx - Homepage
export default async function HomePage() {
  const articles = await getArticles({ page: 1, pageSize: 20 });
  
  return (
    <div>
      <h1>తాజా వార్తలు</h1>
      <div className="grid">
        {articles.items.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
      <Pagination total={articles.totalPages} />
    </div>
  );
}

// components/ArticleCard.tsx
function ArticleCard({ article }) {
  return (
    <Link href={`/article/${article.slug}`}>
      <img src={article.coverImageUrl} alt={article.title} />
      <h3>{article.title}</h3>
      <p>{article.excerpt}</p>
      <span>{article.category.name}</span>
      <time>{formatDate(article.publishedAt)}</time>
    </Link>
  );
}
```

---

### **Legacy API #3: Category Filtering**

**Endpoint:** `GET /public/articles?categorySlug=politics`  
**Purpose:** Filter articles by category  
**Cache:** 5 minutes

```bash
GET /public/articles?categorySlug=politics&page=1&pageSize=20&languageCode=te
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Frontend Usage:**
```typescript
// app/category/[slug]/page.tsx
export default async function CategoryPage({ params }) {
  const { slug } = params;
  const articles = await getArticles({ categorySlug: slug, page: 1 });
  
  return (
    <div>
      <h1>{articles.items[0]?.category.name}</h1>
      <ArticleList articles={articles.items} />
    </div>
  );
}
```

---

### **Legacy API #4: Article Detail**

**Endpoint:** `GET /public/articles/:slug`  
**Purpose:** Get single article with full content  
**Cache:** 10 minutes  
**When:** Article detail page

```bash
GET /public/articles/hyderabad-metro-extension-approved
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Response:**
```json
{
  "id": "art_001",
  "slug": "hyderabad-metro-extension-approved",
  "title": "హైదరాబాద్ మెట్రో విస్తరణకు ఆమోదం",
  "excerpt": "హైదరాబాద్ మెట్రో రైలు కొత్త మార్గాలకు...",
  "contentHtml": "<p>హైదరాబాద్ మెట్రో రైలు కొత్త మార్గాలకు తెలంగాణ ప్రభుత్వం ఆమోదం తెలిపింది. ఈ విస్తరణ ద్వారా...</p>",
  "plainText": "హైదరాబాద్ మెట్రో రైలు కొత్త మార్గాలకు...",
  "coverImageUrl": "https://cdn.kaburlu.com/articles/metro-001.jpg",
  "publishedAt": "2026-01-25T08:30:00.000Z",
  "updatedAt": "2026-01-25T09:00:00.000Z",
  "author": {
    "id": "rep_001",
    "name": "రామ్ కుమార్",
    "avatar": "https://cdn.kaburlu.com/reporters/ram.jpg",
    "bio": "రాజకీయ విభాగం ప్రధాన రిపోర్టర్"
  },
  "category": {
    "id": "cat_1",
    "name": "రాజకీయాలు",
    "slug": "politics"
  },
  "tags": ["హైదరాబాద్", "మెట్రో", "రవాణా", "తెలంగాణ"],
  "relatedArticles": [
    {
      "id": "art_002",
      "slug": "metro-phase-2-routes",
      "title": "మెట్రో రెండవ దశ మార్గాలు ఇవే",
      "coverImageUrl": "https://cdn.kaburlu.com/articles/metro-002.jpg"
    }
  ],
  "seo": {
    "title": "హైదరాబాద్ మెట్రో విస్తరణకు ఆమోదం | తెలంగాణ కబుర్లు",
    "description": "హైదరాబాద్ మెట్రో రైలు కొత్త మార్గాలకు తెలంగాణ ప్రభుత్వం ఆమోదం తెలిపింది",
    "keywords": "హైదరాబాద్ మెట్రో, తెలంగాణ, రవాణా",
    "canonicalUrl": "https://telangana.kaburlu.com/article/hyderabad-metro-extension-approved",
    "jsonLd": {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "హైదరాబాద్ మెట్రో విస్తరణకు ఆమోదం",
      "datePublished": "2026-01-25T08:30:00.000Z",
      "author": { "@type": "Person", "name": "రామ్ కుమార్" }
    }
  },
  "views": 1245,
  "commentsCount": 23,
  "readTime": 3,
  "wordCount": 456
}
```

**Frontend Usage:**
```typescript
// app/article/[slug]/page.tsx
export async function generateMetadata({ params }) {
  const article = await getArticle(params.slug);
  return {
    title: article.seo.title,
    description: article.seo.description,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [article.coverImageUrl]
    }
  };
}

export default async function ArticlePage({ params }) {
  const article = await getArticle(params.slug);
  
  return (
    <article>
      <h1>{article.title}</h1>
      <div className="meta">
        <img src={article.author.avatar} alt={article.author.name} />
        <span>{article.author.name}</span>
        <time>{formatDate(article.publishedAt)}</time>
      </div>
      <img src={article.coverImageUrl} alt={article.title} />
      <div dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
      
      {/* Related Articles */}
      <aside>
        <h3>సంబంధిత వార్తలు</h3>
        {article.relatedArticles.map(rel => (
          <RelatedCard key={rel.id} article={rel} />
        ))}
      </aside>
      
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(article.seo.jsonLd) }}
      />
    </article>
  );
}
```

---

### **Legacy API #5: Homepage Sections**

**Endpoint:** `GET /public/homepage`  
**Purpose:** Get style-based homepage sections  
**Cache:** 5 minutes  
**When:** Homepage with configured sections

```bash
GET /public/homepage
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Response:**
```json
{
  "style": "style2",
  "sections": [
    {
      "id": 1,
      "position": 1,
      "type": "hero_sidebar",
      "heroArticles": [
        {
          "id": "art_001",
          "title": "హైదరాబాద్ మెట్రో విస్తరణకు ఆమోదం",
          "coverImageUrl": "https://cdn.kaburlu.com/articles/metro-001.jpg",
          "slug": "hyderabad-metro-extension"
        }
      ],
      "sidebarArticles": [
        { "id": "art_002", "title": "మరో ముఖ్య వార్త" }
      ]
    },
    {
      "id": 2,
      "position": 2,
      "type": "category_boxes_3col",
      "categories": [
        {
          "slug": "politics",
          "name": "రాజకీయాలు",
          "articles": [
            {
              "id": "art_010",
              "title": "రాజకీయ వార్త",
              "coverImageUrl": "https://cdn.kaburlu.com/articles/pol-001.jpg"
            }
          ]
        }
      ]
    }
  ],
  "extras": {
    "trending": [
      { "id": "art_050", "title": "ట్రెండింగ్ వార్త", "views": 5000 }
    ],
    "mustRead": [
      { "id": "art_051", "title": "తప్పకుండా చదవండి" }
    ]
  }
}
```

**Frontend Usage:**
```typescript
// app/page.tsx - Style-based homepage
export default async function HomePage() {
  const homepage = await getHomepage();
  
  return (
    <div className={`homepage-${homepage.style}`}>
      {homepage.sections.map(section => (
        <Section key={section.id} data={section} />
      ))}
      
      {/* Trending Sidebar */}
      <aside>
        <h3>ట్రెండింగ్ వార్తలు</h3>
        {homepage.extras.trending.map(article => (
          <TrendingCard key={article.id} article={article} />
        ))}
      </aside>
    </div>
  );
}

function Section({ data }) {
  switch (data.type) {
    case 'hero_sidebar':
      return <HeroSidebar {...data} />;
    case 'category_boxes_3col':
      return <CategoryBoxes {...data} />;
    default:
      return null;
  }
}
```

---

### **Legacy API #6: Sitemap & Robots**

**Endpoint:** `GET /public/sitemap.xml`  
**Purpose:** XML sitemap for SEO  
**Cache:** 24 hours

```bash
GET /public/sitemap.xml
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Response:** XML sitemap with all published articles

**Endpoint:** `GET /public/robots.txt`  
**Purpose:** Robots.txt file  
**Cache:** 24 hours

```bash
GET /public/robots.txt
Header: X-Tenant-Domain: telangana.kaburlu.com
```

**Response:**
```
User-agent: *
Allow: /
Sitemap: https://telangana.kaburlu.com/sitemap.xml
```

---

## 🔄 Complete Implementation Examples

---

### **Example 1: App Layout with V2.0 Config**

```typescript
// app/layout.tsx
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

export default async function RootLayout({ children }) {
  const config = await fetch(`${API_BASE}/public/config`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 3600 }
  }).then(r => r.json());
  
  const seo = await fetch(`${API_BASE}/public/seo/homepage`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 3600 }
  }).then(r => r.json());
  
  return (
    <html>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(seo) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

### **Example 2: Complete Homepage Flow**

```typescript
// app/page.tsx - Complete Homepage Example
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

export default async function HomePage() {
  // 1. Get config (cached 1 hour) - V2.0
  const config = await fetch(`${API_BASE}/public/config`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 3600 }
  }).then(r => r.json());
  
  // 2. Get homepage sections (cached 5 minutes) - Legacy
  const homepage = await fetch(`${API_BASE}/public/homepage`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 300 }
  }).then(r => r.json());
  
  // 3. Get trending articles - Legacy
  const trending = await fetch(`${API_BASE}/public/articles?tags=trending&pageSize=10`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 300 }
  }).then(r => r.json());
  
  return (
    <div style={{ 
      fontFamily: config.theme.typography.fontFamily,
      '--primary': config.theme.colors.primary 
    }}>
      {/* Header with config */}
      <Header config={config} />
      
      {/* Breaking News Ticker */}
      {config.layout.showTicker && <NewsTicker />}
      
      {/* Homepage Sections */}
      {homepage.sections.map(section => (
        <DynamicSection key={section.id} section={section} />
      ))}
      
      {/* Trending Sidebar */}
      <aside>
        <h3>ట్రెండింగ్</h3>
        <TrendingList articles={trending.items} />
      </aside>
      
      {/* Footer from config */}
      <Footer config={config} />
    </div>
  );
}
```

---

## 📱 Mobile App Integration

### Push Notifications Setup (V2.0)

```typescript
// Use VAPID public key from V2.0 config
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

const config = await fetch(`${API_BASE}/public/config`, {
  headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN }
}).then(r => r.json());

if (config.features.pwaPushNotifications && config.integrations.push.enabled) {
  const registration = await navigator.serviceWorker.register('/sw.js');
  
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: config.integrations.push.vapidPublicKey
  });
  
  // Send subscription to backend
  await fetch('/api/v1/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription })
  });
}
```

---

## ⚡ Performance Best Practices

### 1. Caching Strategy (Next.js)

```typescript
// Static - Regenerate every hour
export const revalidate = 3600; // Config, categories

// Dynamic - Regenerate every 5 minutes
export const revalidate = 300; // Homepage, articles list

// Per-article - Regenerate every 10 minutes
export const revalidate = 600; // Article detail
```

### 2. Incremental Static Regeneration (ISR)

```typescript
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

// pages/article/[slug].tsx
export async function getStaticProps({ params }) {
  const article = await fetch(`${API_BASE}/public/articles/${params.slug}`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN }
  }).then(r => r.json());
  return {
    props: { article },
    revalidate: 600 // 10 minutes
  };
}

export async function getStaticPaths() {
  // Generate top 100 articles at build time
  const articles = await fetch(`${API_BASE}/public/articles?pageSize=100`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN }
  }).then(r => r.json());
  return {
    paths: articles.items.map(a => ({ params: { slug: a.slug } })),
    fallback: 'blocking' // Generate others on-demand
  };
}
```

### 3. Parallel Data Fetching

```typescript
const API_BASE = 'https://app.kaburlumedia.com/api/v1';
const headers = { 'X-Tenant-Domain': process.env.TENANT_DOMAIN };

// Fetch multiple APIs in parallel
const [config, categories, articles] = await Promise.all([
  fetch(`${API_BASE}/public/config`, { headers, next: { revalidate: 3600 } }).then(r => r.json()),
  fetch(`${API_BASE}/public/categories`, { headers, next: { revalidate: 3600 } }).then(r => r.json()),
  fetch(`${API_BASE}/public/articles?page=1`, { headers, next: { revalidate: 300 } }).then(r => r.json())
]);
```

---

## 🌐 Multi-Language Support

```typescript
const API_BASE = 'https://app.kaburlumedia.com/api/v1';
const headers = { 'X-Tenant-Domain': process.env.TENANT_DOMAIN };

// Language switcher from V2.0 config
const config = await fetch(`${API_BASE}/public/config`, { 
  headers, 
  next: { revalidate: 3600 } 
}).then(r => r.json());

const currentLang = config.content.defaultLanguage;

<select onChange={handleLanguageChange} value={currentLang}>
  {config.content.languages.map(lang => (
    <option key={lang.code} value={lang.code}>
      {lang.nativeName}
    </option>
  ))}
</select>

// Fetch articles in selected language
const articles = await fetch(
  `${API_BASE}/public/articles?languageCode=${selectedLanguage}&page=1`,
  { headers, next: { revalidate: 300 } }
).then(r => r.json());
```

---

## 🎨 Theme Application (V2.0)

```typescript
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

// Apply theme from V2.0 config
const config = await fetch(`${API_BASE}/public/config`, {
  headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
  next: { revalidate: 3600 }
}).then(r => r.json());

<html>
  <head>
    <style>{`
      :root {
        --primary-color: ${config.theme.colors.primary};
        --secondary-color: ${config.theme.colors.secondary};
        --header-bg: ${config.theme.colors.headerBg};
        --footer-bg: ${config.theme.colors.footerBg};
        --font-family: ${config.theme.typography.fontFamily};
        --font-headings: ${config.theme.typography.fontFamilyHeadings};
      }
    `}</style>
  </head>
  <body>
    {children}
  </body>
</html>
```

---

## 🔐 Error Handling

```typescript
const API_BASE = 'https://app.kaburlumedia.com/api/v1';
const TENANT_DOMAIN = process.env.TENANT_DOMAIN;

async function getArticles(params) {
  try {
    const queryString = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/public/articles?${queryString}`, {
      headers: { 'X-Tenant-Domain': TENANT_DOMAIN },
      next: { revalidate: 300 }
    });
    
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    return { items: [], total: 0, page: 1 };
  }
}
```

---

## 📊 Analytics Integration (V2.0)

```typescript
const API_BASE = 'https://app.kaburlumedia.com/api/v1';

// Google Analytics from V2.0 config
const config = await fetch(`${API_BASE}/public/config`, {
  headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
  next: { revalidate: 3600 }
}).then(r => r.json());

if (config.integrations.analytics.enabled) {
  const gaId = config.integrations.analytics.googleAnalytics;
  
  <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
  <script dangerouslySetInnerHTML={{ __html: `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${gaId}');
  `}} />
}
```

---

---

### **Example 3: Complete Article Page**

```typescript
// app/article/[slug]/page.tsx
import { Metadata } from 'next';

const API_BASE = 'https://app.kaburlumedia.com/api/v1';

export const revalidate = 600; // 10 minutes

export async function generateMetadata({ params }): Promise<Metadata> {
  const article = await fetch(`${API_BASE}/public/articles/${params.slug}`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 600 }
  }).then(r => r.json());
  
  return {
    title: article.seo.title,
    description: article.seo.description,
    keywords: article.seo.keywords,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [article.coverImageUrl],
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.author.name]
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: [article.coverImageUrl]
    }
  };
}

export default async function ArticlePage({ params }) {
  const [config, article] = await Promise.all([
    fetch(`${API_BASE}/public/config`, {
      headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
      next: { revalidate: 3600 }
    }).then(r => r.json()),
    fetch(`${API_BASE}/public/articles/${params.slug}`, {
      headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
      next: { revalidate: 600 }
    }).then(r => r.json())
  ]);
  
  return (
    <main>
      {/* Breadcrumbs */}
      {config.layout.showBreadcrumbs && (
        <nav>
          <Link href="/">హోం</Link> / 
          <Link href={`/category/${article.category.slug}`}>
            {article.category.name}
          </Link> /
          <span>{article.title}</span>
        </nav>
      )}
      
      {/* Article */}
      <article>
        <header>
          <span className="category">{article.category.name}</span>
          <h1>{article.title}</h1>
          
          <div className="meta">
            <img src={article.author.avatar} alt={article.author.name} />
            <div>
              <strong>{article.author.name}</strong>
              <time>{formatDate(article.publishedAt)}</time>
            </div>
          </div>
        </header>
        
        <figure>
          <img src={article.coverImageUrl} alt={article.title} />
        </figure>
        
        <div 
          className="content"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }} 
        />
        
        {/* Tags */}
        <div className="tags">
          {article.tags.map(tag => (
            <Link key={tag} href={`/tag/${tag}`}>{tag}</Link>
          ))}
        </div>
        
        {/* Share buttons */}
        {config.features.sharing && (
          <ShareButtons article={article} social={config.social} />
        )}
        
        {/* Bookmark */}
        {config.features.bookmarking && (
          <BookmarkButton articleId={article.id} />
        )}
      </article>
      
      {/* Related Articles */}
      <aside>
        <h3>సంబంధిత వార్తలు</h3>
        {article.relatedArticles.map(rel => (
          <RelatedCard key={rel.id} article={rel} />
        ))}
      </aside>
      
      {/* Comments */}
      {config.features.commenting && (
        <CommentSection articleId={article.id} />
      )}
      
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ 
          __html: JSON.stringify(article.seo.jsonLd) 
        }}
      />
    </main>
  );
}
```

---

## 📝 Summary

### **V2.0 APIs (Recommended - Use These First!)**

| API | Purpose | Cache | Base URL |
|-----|---------|-------|----------|
| `GET /public/config` | Complete configuration | 1 hour | `https://app.kaburlumedia.com/api/v1` |
| `GET /public/homepage` | **NEW!** Style1/Style2 homepage (auto-detect) | 5 min | `https://app.kaburlumedia.com/api/v1` |
| `GET /public/seo/homepage` | Homepage JSON-LD | 1 hour | `https://app.kaburlumedia.com/api/v1` |

**🆕 What's New in V2.0:**
- `/public/homepage` now **auto-detects** theme style from domain settings
- Supports both **Style1** and **Style2** layouts in single endpoint
- No need to specify `?shape=` - automatically uses configured style
- Optional manual override with `?shape=style1` or `?shape=style2`

### **Legacy APIs (Still Supported)**

| API | Purpose | Cache | Base URL |
|-----|---------|-------|----------|
| `GET /public/categories` | Categories list | 1 hour | `https://app.kaburlumedia.com/api/v1` |
| `GET /public/articles` | Articles listing | 5 min | `https://app.kaburlumedia.com/api/v1` |
| `GET /public/articles/:slug` | Article detail | 10 min | `https://app.kaburlumedia.com/api/v1` |
| `GET /public/homepage` | Homepage sections | 5 min | `https://app.kaburlumedia.com/api/v1` |
| `GET /public/sitemap.xml` | XML sitemap | 24 hours | `https://app.kaburlumedia.com/api/v1` |
| `GET /public/robots.txt` | Robots file | 24 hours | `https://app.kaburlumedia.com/api/v1` |

### API Call Sequence for Homepage:
1. **V2.0:** `/public/config` → All configuration (1 hour cache)
2. **V2.0:** `/public/homepage` → **Auto-detect Style1/Style2 content** (5 min cache) ⭐ NEW!
3. **V2.0:** `/public/seo/homepage` → SEO JSON-LD (1 hour cache)
4. **Legacy (Optional):** `/public/categories` → Navigation if needed

**Note:** `/public/homepage` automatically detects theme from domain settings. No need to call separate endpoints for Style1 vs Style2!

### API Call Sequence for Article Page:
1. **V2.0:** `/public/config` → Configuration
2. **Legacy:** `/public/articles/:slug` → Article details

### API Call Sequence for Category Page:
1. **V2.0:** `/public/config` → Configuration
2. **Legacy:** `/public/articles?categorySlug=politics` → Filtered articles

**Note:** All API endpoints require `X-Tenant-Domain` header. Base URL already includes `/api/v1`, so just use the endpoint path directly.

---

## 🚀 Next Steps

1. ✅ Implement config caching in frontend
2. ✅ Set up ISR/SSG for static pages
3. ✅ Add error boundaries
4. ✅ Implement analytics tracking
5. ✅ Set up push notifications
6. ✅ Add dark mode toggle
7. ✅ Implement search functionality
8. ✅ Add commenting system (if enabled)
9. ✅ Implement bookmarking
10. ✅ Set up social sharing

---

**Version:** 2.0  
**Last Updated:** 25 January 2026  
**Backend:** Kaburlu Media Backend  
**Frontend:** Next.js 14+ (App Router recommended)
