# Public Config API - Multi-Tenant Best Practice

## 🎯 Endpoint
```
GET /api/v1/public/config
Header: X-Tenant-Domain: telangana.kaburlu.com
```

## ✨ Features

### Multi-Tenant Optimized Structure
- **Version tracking** - API version for backward compatibility
- **Timestamp** - Server time for cache validation
- **Tenant context** - Complete tenant information with timezone & locale
- **Domain context** - Domain details with environment info
- **Feature flags** - Enable/disable features per tenant
- **Cache hints** - Recommended TTL for different resource types

### Complete Configuration in One Call
- ✅ Branding & Theme (colors, typography, assets)
- ✅ SEO settings (meta, OG, Twitter, JSON-LD, sitemaps)
- ✅ Content settings (languages, date/time formats)
- ✅ Integrations (Analytics, Ads, Push notifications)
- ✅ Navigation (header, footer, mobile menus)
- ✅ Social media links
- ✅ Contact information
- ✅ Layout preferences

---

## 📋 Sample Response

```json
{
  "version": "2.0",
  "timestamp": "2026-01-25T10:30:00.000Z",
  
  "tenant": {
    "id": "cm1234567890",
    "slug": "telangana-kaburlu",
    "name": "Telangana Kaburlu",
    "displayName": "తెలంగాణ కబుర్లు",
    "timezone": "Asia/Kolkata",
    "locale": "te"
  },
  
  "domain": {
    "id": "dom_123456",
    "domain": "telangana.kaburlu.com",
    "baseUrl": "https://telangana.kaburlu.com",
    "kind": "WEBSITE",
    "status": "ACTIVE",
    "environment": "production"
  },
  
  "branding": {
    "siteName": "తెలంగాణ కబుర్లు",
    "siteTagline": "తెలంగాణ వార్తలు - తాజా కబుర్లు",
    "logo": "https://cdn.kaburlu.com/logos/telangana-logo.png",
    "favicon": "https://cdn.kaburlu.com/favicons/telangana-favicon.ico",
    "appleTouchIcon": "https://cdn.kaburlu.com/icons/apple-touch-icon.png"
  },
  
  "theme": {
    "colors": {
      "primary": "#d32f2f",
      "secondary": "#1976d2",
      "headerBg": "#ffffff",
      "footerBg": "#212121"
    },
    "typography": {
      "fontFamily": "Noto Sans Telugu, Hind, system-ui, sans-serif",
      "fontFamilyHeadings": "Tiro Telugu, Noto Sans Telugu, serif"
    },
    "assets": {
      "logo": "https://cdn.kaburlu.com/logos/telangana-logo.png",
      "favicon": "https://cdn.kaburlu.com/favicons/telangana-favicon.ico",
      "headerHtml": null,
      "footerHtml": "<p>పాఠకుల సేవలో</p>"
    },
    "layout": {
      "style": "style2",
      "headerStyle": "modern",
      "footerStyle": "minimal",
      "containerWidth": 1280,
      "homepageConfig": {
        "sections": [
          {
            "id": 1,
            "type": "hero_sidebar",
            "categorySlug": "breaking"
          }
        ]
      }
    }
  },
  
  "seo": {
    "meta": {
      "title": "తెలంగాణ కబుర్లు - తాజా వార్తలు",
      "description": "తెలంగాణ రాష్ట్రం నుండి తాజా వార్తలు, రాజకీయాలు, క్రీడలు, వినోదం మరియు ఇతర కబుర్లు",
      "keywords": "తెలంగాణ, వార్తలు, కబుర్లు, తాజా సమాచారం"
    },
    "openGraph": {
      "url": "https://telangana.kaburlu.com",
      "title": "తెలంగాణ కబుర్లు - తాజా వార్తలు",
      "description": "తెలంగాణ రాష్ట్రం నుండి తాజా వార్తలు",
      "imageUrl": "https://cdn.kaburlu.com/og-images/telangana.jpg",
      "siteName": "తెలంగాణ కబుర్లు"
    },
    "twitter": {
      "card": "summary_large_image",
      "handle": "@telanganakaburlu",
      "title": "తెలంగాణ కబుర్లు - తాజా వార్తలు",
      "description": "తెలంగాణ రాష్ట్రం నుండి తాజా వార్తలు",
      "imageUrl": "https://cdn.kaburlu.com/twitter-images/telangana.jpg"
    },
    "jsonLd": {
      "organizationUrl": "https://telangana.kaburlu.com/#organization",
      "websiteUrl": "https://telangana.kaburlu.com/#website"
    },
    "urls": {
      "robotsTxt": "https://telangana.kaburlu.com/robots.txt",
      "sitemapXml": "https://telangana.kaburlu.com/sitemap.xml",
      "rssFeed": "https://telangana.kaburlu.com/rss.xml"
    }
  },
  
  "content": {
    "defaultLanguage": "te",
    "supportedLanguages": ["te", "en", "hi"],
    "languages": [
      {
        "code": "te",
        "name": "Telugu",
        "nativeName": "తెలుగు",
        "direction": "ltr",
        "defaultForTenant": true
      },
      {
        "code": "en",
        "name": "English",
        "nativeName": "English",
        "direction": "ltr",
        "defaultForTenant": false
      }
    ],
    "dateFormat": "DD/MM/YYYY",
    "timeFormat": "12h"
  },
  
  "integrations": {
    "analytics": {
      "googleAnalytics": "G-XXXXXXXXXX",
      "googleTagManager": "GTM-XXXXXXX",
      "enabled": true
    },
    "ads": {
      "adsense": "ca-pub-1234567890123456",
      "enabled": true
    },
    "push": {
      "vapidPublicKey": "BK7xJt...",
      "enabled": true
    },
    "social": {
      "facebookAppId": "123456789012345",
      "twitterHandle": "@telanganakaburlu"
    }
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
        { "label": "రాజకీయాలు", "href": "/category/politics", "icon": null },
        { "label": "క్రీడలు", "href": "/category/sports", "icon": null },
        { "label": "సినిమా", "href": "/category/cinema", "icon": null },
        { "label": "జాబ్స్", "href": "/category/jobs", "icon": null }
      ],
      "utilityMenu": [
        { "label": "ePaper", "href": "/epaper", "icon": "newspaper" },
        { "label": "వీడియోస్", "href": "/videos", "icon": "play" }
      ],
      "showSearch": true,
      "showLanguageSwitcher": true,
      "sticky": {
        "enabled": true,
        "offsetPx": 80
      }
    },
    "footer": {
      "sections": [
        {
          "title": "గురించి",
          "links": [
            { "label": "మా గురించి", "href": "/about-us" },
            { "label": "సంప్రదించండి", "href": "/contact-us" },
            { "label": "ప్రకటనలు", "href": "/advertise" },
            { "label": "కెరీర్స్", "href": "/careers" }
          ]
        },
        {
          "title": "చట్టపరమైన",
          "links": [
            { "label": "గోప్యతా విధానం", "href": "/privacy-policy" },
            { "label": "నిబంధనలు", "href": "/terms" },
            { "label": "డిస్‌క్లెయిమర్", "href": "/disclaimer" },
            { "label": "సంపాదకీయ విధానం", "href": "/editorial-policy" }
          ]
        },
        {
          "title": "ప్రధాన విభాగాలు",
          "links": [
            { "label": "రాజకీయాలు", "href": "/category/politics" },
            { "label": "వ్యాపారం", "href": "/category/business" },
            { "label": "ఆరోగ్యం", "href": "/category/health" },
            { "label": "విద్య", "href": "/category/education" }
          ]
        }
      ],
      "copyrightText": "© 2026 తెలంగాణ కబుర్లు. అన్ని హక్కులు రిజర్వ్ చేయబడ్డాయి.",
      "showSocialLinks": true
    },
    "mobile": {
      "bottomNav": [
        { "label": "హోం", "href": "/", "icon": "home" },
        { "label": "విభాగాలు", "href": "/categories", "icon": "grid" },
        { "label": "సేవ్ చేసినవి", "href": "/saved", "icon": "bookmark" },
        { "label": "మెను", "href": "/menu", "icon": "menu" }
      ],
      "quickActions": [
        { "label": "వార్తా అలర్ట్‌లు", "href": "/notifications", "icon": "bell" }
      ]
    }
  },
  
  "social": {
    "facebook": "https://facebook.com/telanganakaburlu",
    "twitter": "https://twitter.com/telanganakaburlu",
    "instagram": "https://instagram.com/telanganakaburlu",
    "youtube": "https://youtube.com/@telanganakaburlu",
    "telegram": "https://t.me/telanganakaburlu",
    "linkedin": null,
    "whatsapp": "https://wa.me/919876543210"
  },
  
  "contact": {
    "email": "info@telanganakaburlu.com",
    "phone": "+91 98765 43210",
    "address": {
      "street": "Plot No. 123, Jubilee Hills",
      "city": "Hyderabad",
      "state": "Telangana",
      "country": "India",
      "postalCode": "500033"
    }
  },
  
  "layout": {
    "showTicker": true,
    "showTopBar": true,
    "showBreadcrumbs": true,
    "showReadingProgress": true,
    "articlesPerPage": 20
  },
  
  "admin": {
    "name": "రామ్ కుమార్",
    "mobile": "+91 98765 43210"
  },
  
  "cacheControl": {
    "config": 3600,
    "homepage": 300,
    "article": 600,
    "category": 300,
    "staticPages": 86400
  }
}
```

---

## 🚀 Frontend Integration

### Next.js App Router Example

```typescript
// app/layout.tsx
import { headers } from 'next/headers';

async function getWebsiteConfig() {
  const host = headers().get('host');
  const res = await fetch(`${process.env.API_URL}/api/v1/public/config`, {
    headers: { 'X-Tenant-Domain': host || 'telangana.kaburlu.com' },
    next: { revalidate: 3600 } // ISR with 1 hour cache
  });
  return res.json();
}

export default async function RootLayout({ children }) {
  const config = await getWebsiteConfig();
  
  return (
    <html lang={config.content.defaultLanguage} dir="ltr">
      <head>
        <title>{config.seo.meta.title}</title>
        <meta name="description" content={config.seo.meta.description} />
        <link rel="icon" href={config.branding.favicon} />
        
        {/* Google Analytics */}
        {config.integrations.analytics.enabled && (
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${config.integrations.analytics.googleAnalytics}`} />
        )}
      </head>
      <body style={{
        fontFamily: config.theme.typography.fontFamily,
        '--primary-color': config.theme.colors.primary,
        '--secondary-color': config.theme.colors.secondary
      } as any}>
        <Header config={config} />
        {config.layout.showTicker && <NewsTicker />}
        <main>{children}</main>
        <Footer config={config} />
      </body>
    </html>
  );
}
```

### React Context Provider

```typescript
// contexts/ConfigContext.tsx
'use client';
import { createContext, useContext } from 'react';

interface WebsiteConfig {
  version: string;
  tenant: any;
  domain: any;
  branding: any;
  theme: any;
  features: any;
  navigation: any;
  // ... all other fields
}

const ConfigContext = createContext<WebsiteConfig | null>(null);

export function ConfigProvider({ config, children }: { config: WebsiteConfig; children: React.ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within ConfigProvider');
  return context;
}

// Usage in components
export function ArticleCard() {
  const { theme, features } = useConfig();
  
  return (
    <div style={{ 
      borderColor: theme.colors.primary,
      fontFamily: theme.typography.fontFamily 
    }}>
      {features.bookmarking && <BookmarkButton />}
      {features.sharing && <ShareButton />}
    </div>
  );
}
```

---

## 📊 Best Practices

### 1. Cache Strategy
- **Config endpoint**: Cache for 1 hour (ISR)
- **Homepage**: Cache for 5 minutes (frequent updates)
- **Articles**: Cache for 10 minutes (balance freshness vs performance)
- **Static pages**: Cache for 24 hours (rarely change)

### 2. Feature Flags Usage
```typescript
// Conditionally render features
{config.features.commenting && <CommentSection />}
{config.features.darkMode && <DarkModeToggle />}
{config.features.pwaPushNotifications && <PushSubscribe />}
{config.features.newsletter && <NewsletterSignup />}
```

### 3. Multi-Language Support
```typescript
// Language switcher
const languages = config.content.languages;
const currentLang = config.content.defaultLanguage;

<select value={currentLang}>
  {languages.map(lang => (
    <option key={lang.code} value={lang.code}>
      {lang.nativeName}
    </option>
  ))}
</select>
```

### 4. Responsive Navigation
```typescript
// Desktop: header.primaryMenu
// Mobile: mobile.bottomNav
const isMobile = useMediaQuery('(max-width: 768px)');
const menu = isMobile 
  ? config.navigation.mobile.bottomNav 
  : config.navigation.header.primaryMenu;
```

---

## 🔧 Environment-Specific Behavior

### Development
```json
{
  "domain": {
    "environment": "development"
  }
}
```
- Show debug info
- Disable analytics
- Use test ads

### Production
```json
{
  "domain": {
    "environment": "production"
  }
}
```
- Enable full analytics
- Enable real ads
- Strict error handling

---

## 🎯 Key Benefits

1. **Single API Call** - All config in one request (reduces RTT)
2. **Type-Safe** - Well-structured JSON schema
3. **Multi-Tenant** - Per-tenant/domain customization
4. **Feature Flags** - Enable/disable features dynamically
5. **Cache Hints** - Optimal cache TTL recommendations
6. **Versioned** - API version for backward compatibility
7. **Complete** - Everything needed for SSR/ISR/CSR
8. **Localized** - Multi-language support out of the box

---

## 📝 Notes

- Use `X-Tenant-Domain` header for local testing
- In production, domain is auto-detected from `Host` header
- Cache the response on client-side (1 hour recommended)
- Re-fetch on user preference changes (language, theme)
- Use version field to handle breaking changes gracefully
