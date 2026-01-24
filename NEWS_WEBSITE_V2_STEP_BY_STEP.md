# News Website V2.0 APIs - Complete Step by Step Guide

## 🎯 Overview

This guide shows the **complete flow** for building a multi-tenant Telugu news website frontend using News Website API v2.0.

### Key Benefits of V2.0
- ✅ **Single config endpoint** - All settings in one call
- ✅ **Better performance** - Fewer API calls needed
- ✅ **Feature flags** - Enable/disable features per tenant
- ✅ **Multi-language** - Built-in language support
- ✅ **Cache hints** - Optimal caching recommendations
- ✅ **SEO optimized** - JSON-LD, sitemaps, robots.txt

---

## 📋 API Endpoints Summary

| API | Purpose | When to Call |
|-----|---------|--------------|
| `GET /api/v1/public/config` | Complete website configuration | App initialization (once) |
| `GET /api/v1/public/categories` | Categories list | Navigation, filters |
| `GET /api/v1/public/articles` | Articles listing | Homepage, category pages |
| `GET /api/v1/public/articles/:slug` | Single article | Article detail page |
| `GET /api/v1/public/homepage` | Homepage sections | Homepage (style-based) |
| `GET /api/v1/public/seo/homepage` | Homepage SEO | Homepage JSON-LD |
| `GET /api/v1/public/sitemap.xml` | XML sitemap | SEO crawlers |
| `GET /api/v1/public/robots.txt` | Robots file | SEO crawlers |

---

## 🚀 Step-by-Step Implementation

### **Step 1: App Initialization - Get Config**

**When:** Once during app load or SSR page build  
**Cache:** 1 hour (ISR)

```bash
GET /api/v1/public/config
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
export async function generateMetadata() {
  const config = await getConfig();
  return {
    title: config.branding.siteName,
    description: config.seo.meta.description,
    icons: { icon: config.branding.favicon }
  };
}

async function getConfig() {
  const res = await fetch(`${API_URL}/api/v1/public/config`, {
    headers: { 'X-Tenant-Domain': process.env.TENANT_DOMAIN },
    next: { revalidate: 3600 } // Cache 1 hour
  });
  return res.json();
}
```

---

### **Step 2: Get Categories**

**When:** Navigation menu, category pages, filters  
**Cache:** 1 hour

```bash
GET /api/v1/public/categories?languageCode=te
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

### **Step 3: Homepage - Get Articles**

**When:** Homepage, category pages, latest articles  
**Cache:** 5 minutes

```bash
GET /api/v1/public/articles?page=1&pageSize=20&languageCode=te
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

### **Step 4: Category Page - Filter by Category**

```bash
GET /api/v1/public/articles?categorySlug=politics&page=1&pageSize=20&languageCode=te
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

### **Step 5: Article Detail Page**

**When:** Single article view  
**Cache:** 10 minutes

```bash
GET /api/v1/public/articles/hyderabad-metro-extension-approved
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

### **Step 6: Homepage Sections (Style-based)**

**When:** Homepage with styled sections  
**Cache:** 5 minutes

```bash
GET /api/v1/public/homepage
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

### **Step 7: SEO - Homepage JSON-LD**

**When:** Homepage SEO  
**Cache:** 1 hour

```bash
GET /api/v1/public/seo/homepage
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
export default async function RootLayout({ children }) {
  const seo = await getHomepageSEO();
  
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

### **Step 8: Sitemap & Robots**

```bash
# XML Sitemap
GET /api/v1/public/sitemap.xml
Header: X-Tenant-Domain: telangana.kaburlu.com

# Response: XML sitemap with all published articles
```

```bash
# Robots.txt
GET /api/v1/public/robots.txt
Header: X-Tenant-Domain: telangana.kaburlu.com

# Response:
User-agent: *
Allow: /
Sitemap: https://telangana.kaburlu.com/sitemap.xml
```

---

## 🔄 Complete Homepage Flow

```typescript
// app/page.tsx - Complete Homepage Example
export default async function HomePage() {
  // 1. Get config (cached 1 hour)
  const config = await getConfig();
  
  // 2. Get homepage sections (cached 5 minutes)
  const homepage = await getHomepage();
  
  // 3. Get trending articles separately if needed
  const trending = await getArticles({ 
    tags: 'trending', 
    pageSize: 10 
  });
  
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

### Push Notifications Setup

```typescript
// Use VAPID public key from config
const config = await getConfig();

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
// pages/article/[slug].tsx
export async function getStaticProps({ params }) {
  const article = await getArticle(params.slug);
  return {
    props: { article },
    revalidate: 600 // 10 minutes
  };
}

export async function getStaticPaths() {
  // Generate top 100 articles at build time
  const articles = await getArticles({ pageSize: 100 });
  return {
    paths: articles.items.map(a => ({ params: { slug: a.slug } })),
    fallback: 'blocking' // Generate others on-demand
  };
}
```

### 3. Parallel Data Fetching

```typescript
// Fetch multiple APIs in parallel
const [config, categories, articles] = await Promise.all([
  getConfig(),
  getCategories(),
  getArticles({ page: 1 })
]);
```

---

## 🌐 Multi-Language Support

```typescript
// Language switcher
const config = await getConfig();
const currentLang = config.content.defaultLanguage;

<select onChange={handleLanguageChange} value={currentLang}>
  {config.content.languages.map(lang => (
    <option key={lang.code} value={lang.code}>
      {lang.nativeName}
    </option>
  ))}
</select>

// Fetch articles in selected language
const articles = await getArticles({ 
  languageCode: selectedLanguage,
  page: 1 
});
```

---

## 🎨 Theme Application

```typescript
// Apply theme from config
const config = await getConfig();

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
async function getArticles(params) {
  try {
    const res = await fetch(`${API_URL}/api/v1/public/articles`, {
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

## 📊 Analytics Integration

```typescript
// Google Analytics from config
const config = await getConfig();

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

## 🎯 Complete Example: Article Page

```typescript
// app/article/[slug]/page.tsx
import { Metadata } from 'next';

export const revalidate = 600; // 10 minutes

export async function generateMetadata({ params }): Promise<Metadata> {
  const article = await getArticle(params.slug);
  
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
    getConfig(),
    getArticle(params.slug)
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

### API Call Sequence for Homepage:
1. **GET /config** → Get all configuration (cache 1 hour)
2. **GET /categories** → Get navigation categories (cache 1 hour)
3. **GET /homepage** OR **GET /articles** → Get content (cache 5 min)
4. **GET /seo/homepage** → Get JSON-LD (cache 1 hour)

### API Call Sequence for Article Page:
1. **GET /config** → Get configuration (cache 1 hour)
2. **GET /articles/:slug** → Get article details (cache 10 min)

### API Call Sequence for Category Page:
1. **GET /config** → Get configuration (cache 1 hour)
2. **GET /articles?categorySlug=politics** → Get filtered articles (cache 5 min)

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
