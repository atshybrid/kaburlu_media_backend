# Tenant Admin Dashboard - Complete API Integration Guide

## Base Configuration

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://app.kaburlumedia.com/api/v1';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('accessToken'); // or from auth context
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return res.json();
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint),
  post: <T>(endpoint: string, data: any) => apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: any) => apiRequest<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data: any) => apiRequest<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' }),
};
```

---

## 1. Tenant Overview

### Get Tenant Details
```typescript
// GET /api/v1/tenants/{tenantId}
const tenant = await api.get(`/tenants/${tenantId}`);

// Response:
{
  id: "cmxyz123",
  name: "Kaburlu Today",
  slug: "kaburlu-today",
  prgiNumber: "PRGI-TS-2025-001",
  prgiStatus: "VERIFIED", // PENDING | VERIFIED | ACTIVE | INACTIVE
  stateId: "cmstate123",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-10T00:00:00.000Z"
}
```

---

## 2. Entity Tab

### Get Entity Details
```typescript
// GET /api/v1/tenants/{tenantId}/entity
const entity = await api.get(`/tenants/${tenantId}/entity`);

// Response:
{
  id: "cmentity123",
  tenantId: "cmxyz123",
  prgiNumber: "PRGI-TS-2025-001",
  registrationTitle: "Kaburlu Today News",
  nativeName: "కాబుర్లు టుడే",
  periodicity: "DAILY", // DAILY | WEEKLY | FORTNIGHTLY | MONTHLY
  registrationDate: "2025-01-01T00:00:00.000Z",
  languageId: "cmlang_te",
  language: { id: "cmlang_te", name: "Telugu", code: "te" },
  ownerName: "Publisher Name",
  publisherName: "Publisher Name",
  editorName: "Editor Name",
  publicationStateId: "cmstate_ts",
  publicationState: { id: "cmstate_ts", name: "Telangana" },
  publicationDistrictId: null,
  printingPressName: "Print Press Name",
  printingCityName: "Hyderabad",
  address: "123 Main St, Hyderabad",
  tenant: { id: "cmxyz123", name: "Kaburlu Today", slug: "kaburlu-today" }
}
```

### Create/Update Entity (Simple)
```typescript
// POST /api/v1/tenants/{tenantId}/entity/simple
const result = await api.post(`/tenants/${tenantId}/entity/simple`, {
  languageId: "cmlang_te",
  periodicity: "DAILY",
  registrationDate: "01/01/2025", // DD/MM/YYYY format
  publisherName: "Publisher Name",
  editorName: "Editor Name",
  printingPressName: "Print Press",
  printingCityName: "Hyderabad",
  address: "123 Main St",
  adminMobile: "9876543210" // Creates TENANT_ADMIN user if provided
});

// Response:
{
  entity: { ... }, // Full entity object
  tenantAdminSetup: { createdOrUpdated: true, mobile: "9876543210" }
}
```

### Update Entity (Full)
```typescript
// PUT /api/v1/tenants/{tenantId}/entity
await api.put(`/tenants/${tenantId}/entity`, {
  registrationTitle: "Updated Title",
  nativeName: "నేటివ్ పేరు",
  periodicity: "DAILY",
  languageId: "cmlang_te",
  ownerName: "Owner",
  publisherName: "Publisher",
  editorName: "Editor",
  publicationStateId: "cmstate_ts",
  publicationDistrictId: "cmdistrict_hyd",
  printingPressName: "Press Name",
  printingCityName: "City",
  address: "Full Address"
});
```

---

## 3. Domains Tab

### List All Domains
```typescript
// GET /api/v1/domains
const domains = await api.get('/domains');

// Response:
[
  {
    id: "cmdomain123",
    tenantId: "cmxyz123",
    domain: "kaburlutoday.com",
    isPrimary: true,
    status: "ACTIVE", // PENDING | VERIFYING | ACTIVE | FAILED
    kind: "NEWS", // NEWS | EPAPER | null
    verificationToken: "abc123xyz",
    verifiedAt: "2025-01-05T00:00:00.000Z",
    tenant: { id: "cmxyz123", name: "Kaburlu Today" }
  }
]
```

### Add Domain to Tenant
```typescript
// POST /api/v1/tenants/{tenantId}/domains
const result = await api.post(`/tenants/${tenantId}/domains`, {
  domain: "news.kaburlutoday.com",
  isPrimary: false
});

// Response:
{
  domain: { id: "cmdomain456", domain: "news.kaburlutoday.com", status: "PENDING", ... },
  verifyInstruction: {
    type: "DNS_TXT",
    name: "_kaburlu-verify.news.kaburlutoday.com",
    value: "abc123verification"
  }
}
```

### Verify Domain
```typescript
// POST /api/v1/domains/{domainId}/verify
await api.post(`/domains/${domainId}/verify`, {
  method: "MANUAL", // or "DNS_TXT"
  force: true // Skip DNS check, mark as ACTIVE
});
```

### Set Domain Kind
```typescript
// PATCH /api/v1/domains/{domainId}/kind
await api.patch(`/domains/${domainId}/kind`, {
  kind: "NEWS" // or "EPAPER"
});
```

### Update Domain Categories
```typescript
// PUT /api/v1/domains/{domainId}/categories
await api.put(`/domains/${domainId}/categories`, {
  categorySlugs: ["politics", "sports", "entertainment"],
  createIfMissingTranslations: true
});

// OR by IDs:
await api.put(`/domains/${domainId}/categories`, {
  categoryIds: ["cmcat1", "cmcat2", "cmcat3"]
});
```

---

## 4. Categories Tab

### Get Tenant Categories
```typescript
// GET /api/v1/tenants/{tenantId}/categories
const categories = await api.get(`/tenants/${tenantId}/categories`);

// Response:
[
  {
    id: "cmcat1",
    slug: "politics",
    name: "Politics",
    translatedName: "రాజకీయాలు", // In tenant's primary language
    parentId: null
  }
]
```

### Update Tenant Categories (All Domains)
```typescript
// PUT /api/v1/tenants/{tenantId}/categories
await api.put(`/tenants/${tenantId}/categories`, {
  categorySlugs: ["politics", "sports", "entertainment", "business"]
});

// Response:
{
  count: 4,
  categories: [...],
  domainsUpdated: 2
}
```

---

## 5. Branding Tab

### Get Theme
```typescript
// GET /api/v1/tenant-theme/{tenantId}
const theme = await api.get(`/tenant-theme/${tenantId}`);

// Response:
{
  id: "cmtheme123",
  tenantId: "cmxyz123",
  logoUrl: "https://cdn.example.com/logo.png",
  faviconUrl: "https://cdn.example.com/favicon.ico",
  primaryColor: "#e11d48",
  secondaryColor: "#1e293b",
  headerBgColor: "#ffffff",
  footerBgColor: "#1e293b",
  headerHtml: "<div>Custom header</div>",
  footerHtml: "<div>Custom footer</div>",
  fontFamily: "Inter",
  homepageConfig: { ... },
  seoConfig: { ... }
}
```

### Update Theme
```typescript
// PATCH /api/v1/tenant-theme/{tenantId}
await api.patch(`/tenant-theme/${tenantId}`, {
  logoUrl: "https://cdn.example.com/new-logo.png",
  faviconUrl: "https://cdn.example.com/favicon.ico",
  primaryColor: "#e11d48",
  secondaryColor: "#1e293b",
  headerBgColor: "#ffffff",
  footerBgColor: "#1e293b",
  headerHtml: "<header>...</header>",
  footerHtml: "<footer>...</footer>",
  fontFamily: "Inter"
});
```

---

## 6. Homepage Tab

### Get Style1 Homepage Config
```typescript
// GET /api/v1/tenant-theme/{tenantId}/homepage/style1
const config = await api.get(`/tenant-theme/${tenantId}/homepage/style1`);

// Response:
{
  heroCount: 1,
  topStoriesCount: 5,
  sections: [
    { key: "flashTicker", label: "Flash News", limit: 12 },
    { key: "categoryHub", label: "Categories", categorySlugs: ["politics", "sports"], limit: 5 },
    { key: "hgBlock", label: "Highlights", limit: 5 }
  ]
}
```

### Apply Default Style1 Config
```typescript
// POST /api/v1/tenant-theme/{tenantId}/homepage/style1/apply-default
await api.post(`/tenant-theme/${tenantId}/homepage/style1/apply-default`, {});
```

### Update Style1 Sections
```typescript
// PATCH /api/v1/tenant-theme/{tenantId}/homepage/style1/sections
await api.patch(`/tenant-theme/${tenantId}/homepage/style1/sections`, {
  sections: [
    { key: "flashTicker", label: "Breaking", limit: 10 },
    { key: "categoryHub", categorySlugs: ["politics", "sports", "entertainment"], limit: 6 },
    { key: "hgBlock", label: "Top Stories", limit: 8 }
  ]
});
```

### Get Style2 Theme Configuration
```typescript
// GET /api/v1/tenant-theme/{tenantId}/style2-config
const config = await api.get(`/tenant-theme/${tenantId}/style2-config`);

// Response:
{
  success: true,
  data: {
    sections: [
      { 
        id: 1, 
        position: 1, 
        section_type: "hero_sidebar", 
        hero_category: "latest", 
        sidebar_category: "trending",
        theme_color: "emerald" 
      },
      { 
        id: 2, 
        position: 2, 
        section_type: "category_boxes_3col", 
        categories: ["politics", "sports", "entertainment"] 
      }
    ]
  }
}
```

### Apply Default Style2 Config
```typescript
// POST /api/v1/tenant-theme/{tenantId}/style2-config/apply-default
await api.post(`/tenant-theme/${tenantId}/style2-config/apply-default`, {});
```

### Update Style2 Sections
```typescript
// PUT /api/v1/tenant-theme/{tenantId}/style2-config
await api.put(`/tenant-theme/${tenantId}/style2-config`, {
  sections: [
    { 
      id: 1, 
      position: 1, 
      section_type: "hero_sidebar", 
      hero_category: "latest",
      sidebar_category: "trending",
      theme_color: "emerald" 
    },
    { 
      id: 2, 
      position: 2, 
      section_type: "magazine_grid", 
      category: "politics",
      theme_color: "blue" 
    }
  ]
});
```

---

## 7. Ads Tab

### Get Style1 Ads Config
```typescript
// GET /api/v1/tenants/{tenantId}/ads/style1
const adsConfig = await api.get(`/tenants/${tenantId}/ads/style1`);

// Response:
{
  ads: {
    enabled: true,
    debug: false,
    googleAdsense: { client: "ca-pub-1234567890" },
    slots: {
      home_top_banner: { enabled: true, provider: "google", google: { slot: "1234567890", format: "auto" } },
      article_inline: { enabled: true, provider: "local", local: { imageUrl: "...", clickUrl: "..." } }
    }
  }
}
```

### Update Style1 Ads
```typescript
// PUT /api/v1/tenants/{tenantId}/ads/style1 (full replace)
// PATCH /api/v1/tenants/{tenantId}/ads/style1 (partial merge)

await api.patch(`/tenants/${tenantId}/ads/style1`, {
  ads: {
    enabled: true,
    googleAdsense: { client: "ca-pub-1234567890123456" },
    slots: {
      home_top_banner: {
        enabled: true,
        provider: "google",
        google: { slot: "1000000001", format: "auto", responsive: true }
      },
      article_sidebar: {
        enabled: true,
        provider: "local",
        local: {
          imageUrl: "https://cdn.example.com/ads/sidebar.jpg",
          clickUrl: "https://sponsor.example.com",
          alt: "Sponsor"
        }
      }
    }
  }
});
```

### Get/Update Style2 Ads
```typescript
// GET /api/v1/tenants/{tenantId}/ads/style2
// PUT /api/v1/tenants/{tenantId}/ads/style2
// PATCH /api/v1/tenants/{tenantId}/ads/style2
// (Same structure as style1)
```

---

## 8. SEO Tab

### Get SEO Config
```typescript
// GET /api/v1/tenant-theme/{tenantId}/seo
const seo = await api.get(`/tenant-theme/${tenantId}/seo`);

// Response:
{
  metaTitle: "Kaburlu Today - Latest News",
  metaDescription: "Your trusted source for Telugu news",
  metaKeywords: "telugu news, kaburlu, today news",
  ogTitle: "Kaburlu Today",
  ogDescription: "Latest Telugu News",
  ogImage: "https://cdn.example.com/og-image.jpg",
  twitterCard: "summary_large_image",
  twitterHandle: "@kaburlutoday",
  googleAnalyticsId: "G-XXXXXXXXXX",
  facebookPixelId: "1234567890",
  robotsTxt: "User-agent: *\nAllow: /",
  sitemapEnabled: true
}
```

### Update SEO Config
```typescript
// PATCH /api/v1/tenant-theme/{tenantId}/seo
await api.patch(`/tenant-theme/${tenantId}/seo`, {
  metaTitle: "Kaburlu Today - Latest Telugu News",
  metaDescription: "Your trusted source for breaking news in Telugu",
  metaKeywords: "telugu news, kaburlu, hyderabad news",
  ogTitle: "Kaburlu Today",
  ogDescription: "Breaking Telugu News",
  ogImage: "https://cdn.example.com/og.jpg",
  twitterCard: "summary_large_image",
  twitterHandle: "@kaburlutoday",
  googleAnalyticsId: "G-ABC123XYZ",
  facebookPixelId: "1234567890123456",
  robotsTxt: "User-agent: *\nAllow: /\nDisallow: /admin",
  sitemapEnabled: true
});
```

---

## 9. Payments Tab (Razorpay Config)

### Get Razorpay Config
```typescript
// GET /api/v1/tenants/{tenantId}/razorpay-config
const config = await api.get(`/tenants/${tenantId}/razorpay-config`);

// Response:
{
  id: "cmrzp123",
  tenantId: "cmxyz123",
  keyId: "rzp_live_xxxxx",
  keySecretMasked: "abcd***xy", // Secret is masked
  active: true,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-10T00:00:00.000Z"
}
```

### Create/Update Razorpay Config
```typescript
// PUT /api/v1/tenants/{tenantId}/razorpay-config (upsert)
await api.put(`/tenants/${tenantId}/razorpay-config`, {
  keyId: "rzp_live_xxxxxxxxxxxxx",
  keySecret: "xxxxxxxxxxxxxxxxxxxxxxxx",
  active: true
});

// Response:
{
  id: "cmrzp123",
  tenantId: "cmxyz123",
  keyId: "rzp_live_xxxxxxxxxxxxx",
  active: true,
  createdAt: "...",
  updatedAt: "..."
}
```

---

## 10. Settings Tab (Feature Flags)

### Get Feature Flags
```typescript
// GET /api/v1/tenants/{tenantId}/feature-flags
const flags = await api.get(`/tenants/${tenantId}/feature-flags`);

// Response:
{
  tenantId: "cmxyz123",
  enableEpaper: false,
  enableAds: true,
  enableComments: false,
  enableSocialShare: true,
  enablePushNotifications: false,
  enableNewsletter: true,
  enableSearch: true,
  enableRelatedArticles: true,
  enableTrending: true,
  enableBreakingNews: false,
  enableVideo: true,
  enableGallery: true,
  enablePolls: false,
  enableLiveTv: false,
  enableDarkMode: true,
  enableMultiLang: false,
  enableReporterBylines: true,
  enableLocationFilter: false,
  aiArticleRewriteEnabled: true
}
```

### Update Feature Flags
```typescript
// PATCH /api/v1/tenants/{tenantId}/feature-flags
await api.patch(`/tenants/${tenantId}/feature-flags`, {
  enableEpaper: true,
  enableComments: true,
  enableBreakingNews: true,
  enablePolls: true
});

// Partial update - only provided fields are changed
```

---

## 11. ID Cards Tab

### Get ID Card Settings
```typescript
// GET /api/v1/tenants/{tenantId}/id-card-settings
const settings = await api.get(`/tenants/${tenantId}/id-card-settings`);

// Response:
{
  id: "cmidcard123",
  tenantId: "cmxyz123",
  templateId: "STYLE_1",
  frontLogoUrl: "https://cdn.example.com/logo.png",
  roundStampUrl: "https://cdn.example.com/stamp.png",
  signUrl: "https://cdn.example.com/signature.png",
  primaryColor: "#004f9f",
  secondaryColor: "#ff0000",
  termsJson: ["Terms line 1", "Terms line 2"],
  officeAddress: "123 Main St, Hyderabad",
  helpLine1: "1800-XXX-XXXX",
  helpLine2: "9876543210",
  validityType: "PER_USER_DAYS", // or "FIXED_END_DATE"
  validityDays: 365,
  fixedValidUntil: null,
  idPrefix: "KM",
  idDigits: 6
}
```

### Update ID Card Settings
```typescript
// PUT /api/v1/tenants/{tenantId}/id-card-settings
await api.put(`/tenants/${tenantId}/id-card-settings`, {
  templateId: "STYLE_1",
  frontLogoUrl: "https://cdn.example.com/logo.png",
  roundStampUrl: "https://cdn.example.com/stamp.png",
  signUrl: "https://cdn.example.com/sign.png",
  primaryColor: "#004f9f",
  secondaryColor: "#ff0000",
  termsJson: ["Valid for press work only", "Report lost cards immediately"],
  officeAddress: "Press Office, Hyderabad",
  helpLine1: "1800-123-4567",
  helpLine2: "9876543210",
  validityType: "PER_USER_DAYS",
  validityDays: 365,
  idPrefix: "KM",
  idDigits: 6
});
```

---

## 12. Legal Pages Tab

### List Pages
```typescript
// GET /api/v1/tenants/{tenantId}/pages
const pages = await api.get(`/tenants/${tenantId}/pages`);

// Response:
[
  {
    id: "cmpage1",
    tenantId: "cmxyz123",
    slug: "privacy-policy",
    title: "Privacy Policy",
    published: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-10T00:00:00.000Z"
  },
  {
    id: "cmpage2",
    slug: "terms-of-service",
    title: "Terms of Service",
    published: true,
    ...
  }
]
```

### Get Page by Slug
```typescript
// GET /api/v1/tenants/{tenantId}/pages/{slug}
const page = await api.get(`/tenants/${tenantId}/pages/privacy-policy`);

// Response:
{
  id: "cmpage1",
  tenantId: "cmxyz123",
  slug: "privacy-policy",
  title: "Privacy Policy",
  contentHtml: "<h1>Privacy Policy</h1><p>...</p>",
  meta: { keywords: "privacy, data" },
  published: true,
  createdAt: "...",
  updatedAt: "..."
}
```

### Create/Update Page
```typescript
// PUT /api/v1/tenants/{tenantId}/pages/{slug}
await api.put(`/tenants/${tenantId}/pages/privacy-policy`, {
  title: "Privacy Policy",
  contentHtml: "<h1>Privacy Policy</h1><p>Your privacy is important to us...</p>",
  meta: { keywords: "privacy, data protection" },
  published: true
});
```

### Patch Page
```typescript
// PATCH /api/v1/tenants/{tenantId}/pages/{slug}
await api.patch(`/tenants/${tenantId}/pages/privacy-policy`, {
  published: false // Just unpublish
});
```

### Delete Page
```typescript
// DELETE /api/v1/tenants/{tenantId}/pages/{slug}
await api.delete(`/tenants/${tenantId}/pages/privacy-policy`);
```

---

## 13. Reporters Tab

### List Reporters
```typescript
// GET /api/v1/tenants/{tenantId}/reporters
const reporters = await api.get(`/tenants/${tenantId}/reporters`);

// Response:
[
  {
    id: "cmreporter1",
    tenantId: "cmxyz123",
    userId: "cmuser1",
    level: "DISTRICT", // STATE | DISTRICT | ASSEMBLY | MANDAL
    designationId: "cmdesig1",
    designation: { id: "cmdesig1", name: "Senior Reporter", code: "SR" },
    stateId: "cmstate_ts",
    districtId: "cmdistrict_hyd",
    mandalId: null,
    kycStatus: "APPROVED", // PENDING | APPROVED | REJECTED
    profilePhotoUrl: "https://cdn.example.com/photo.jpg",
    active: true,
    subscriptionActive: true,
    fullName: "Reporter Name",
    mobileNumber: "9876543210",
    autoPublish: true
  }
]
```

### Get Reporter Details
```typescript
// GET /api/v1/tenants/{tenantId}/reporters/{reporterId}
const reporter = await api.get(`/tenants/${tenantId}/reporters/${reporterId}`);
```

### Create Reporter
```typescript
// POST /api/v1/tenants/{tenantId}/reporters
await api.post(`/tenants/${tenantId}/reporters`, {
  mobileNumber: "9876543210",
  fullName: "New Reporter",
  designationId: "cmdesig1",
  level: "DISTRICT",
  stateId: "cmstate_ts",
  districtId: "cmdistrict_hyd"
});
```

### Update Reporter
```typescript
// PUT /api/v1/tenants/{tenantId}/reporters/{reporterId}
await api.put(`/tenants/${tenantId}/reporters/${reporterId}`, {
  designationId: "cmdesig2",
  level: "STATE",
  stateId: "cmstate_ts",
  active: true
});
```

### Toggle Auto-Publish
```typescript
// PATCH /api/v1/tenants/{tenantId}/reporters/{reporterId}/auto-publish
await api.patch(`/tenants/${tenantId}/reporters/${reporterId}/auto-publish`, {
  autoPublish: true
});
```

---

## React Hooks Examples

```typescript
// hooks/useTenantData.ts
import useSWR from 'swr';
import { api } from '@/lib/api';

export function useTenant(tenantId: string) {
  return useSWR(`/tenants/${tenantId}`, api.get);
}

export function useTenantEntity(tenantId: string) {
  return useSWR(`/tenants/${tenantId}/entity`, api.get);
}

export function useTenantTheme(tenantId: string) {
  return useSWR(`/tenant-theme/${tenantId}`, api.get);
}

export function useTenantSeo(tenantId: string) {
  return useSWR(`/tenant-theme/${tenantId}/seo`, api.get);
}

export function useTenantFeatureFlags(tenantId: string) {
  return useSWR(`/tenants/${tenantId}/feature-flags`, api.get);
}

export function useTenantCategories(tenantId: string) {
  return useSWR(`/tenants/${tenantId}/categories`, api.get);
}

export function useTenantReporters(tenantId: string) {
  return useSWR(`/tenants/${tenantId}/reporters`, api.get);
}

export function useTenantPages(tenantId: string) {
  return useSWR(`/tenants/${tenantId}/pages`, api.get);
}

export function useTenantIdCardSettings(tenantId: string) {
  return useSWR(`/tenants/${tenantId}/id-card-settings`, api.get);
}

export function useTenantRazorpayConfig(tenantId: string) {
  return useSWR(`/tenants/${tenantId}/razorpay-config`, api.get);
}

export function useTenantAdsStyle1(tenantId: string) {
  return useSWR(`/tenants/${tenantId}/ads/style1`, api.get);
}

export function useTenantHomepageStyle1(tenantId: string) {
  return useSWR(`/tenant-theme/${tenantId}/homepage/style1`, api.get);
}
```

---

## Migration Required

Before using new APIs, run Prisma migration:

```bash
# Development
npm run prisma:migrate:dev

# Production (Render)
npm run prisma:migrate:deploy
```

New fields added:
- `TenantTheme`: `secondaryColor`, `headerBgColor`, `footerBgColor`, `footerHtml`, `fontFamily`, `seoConfig`
- `TenantFeatureFlags`: All `enable*` boolean fields

---

## Summary - All Endpoints

| Tab | Method | Endpoint | Status |
|-----|--------|----------|--------|
| Overview | GET | `/tenants/{id}` | ✅ |
| Entity | GET | `/tenants/{id}/entity` | ✅ |
| Entity | POST | `/tenants/{id}/entity/simple` | ✅ |
| Entity | PUT | `/tenants/{id}/entity` | ✅ |
| Domains | GET | `/domains` | ✅ |
| Domains | POST | `/tenants/{id}/domains` | ✅ |
| Domains | POST | `/domains/{id}/verify` | ✅ |
| Domains | PATCH | `/domains/{id}/kind` | ✅ |
| Domains | PUT | `/domains/{id}/categories` | ✅ |
| Categories | GET | `/tenants/{id}/categories` | ✅ |
| Categories | PUT | `/tenants/{id}/categories` | ✅ NEW |
| Branding | GET | `/tenant-theme/{id}` | ✅ |
| Branding | PATCH | `/tenant-theme/{id}` | ✅ |
| Homepage | GET | `/tenant-theme/{id}/homepage/style1` | ✅ |
| Homepage | POST | `/tenant-theme/{id}/homepage/style1/apply-default` | ✅ |
| Homepage | PATCH | `/tenant-theme/{id}/homepage/style1/sections` | ✅ |
| Homepage | GET | `/tenant-theme/{id}/style2-config` | ✅ |
| Homepage | POST | `/tenant-theme/{id}/style2-config/apply-default` | ✅ |
| Homepage | PUT | `/tenant-theme/{id}/style2-config` | ✅ |
| Ads | GET | `/tenants/{id}/ads/style1` | ✅ |
| Ads | PUT/PATCH | `/tenants/{id}/ads/style1` | ✅ |
| Ads | GET | `/tenants/{id}/ads/style2` | ✅ |
| Ads | PUT/PATCH | `/tenants/{id}/ads/style2` | ✅ |
| SEO | GET | `/tenant-theme/{id}/seo` | ✅ NEW |
| SEO | PATCH | `/tenant-theme/{id}/seo` | ✅ NEW |
| Payments | GET | `/tenants/{id}/razorpay-config` | ✅ |
| Payments | PUT | `/tenants/{id}/razorpay-config` | ✅ |
| Settings | GET | `/tenants/{id}/feature-flags` | ✅ ENHANCED |
| Settings | PATCH | `/tenants/{id}/feature-flags` | ✅ ENHANCED |
| ID Cards | GET | `/tenants/{id}/id-card-settings` | ✅ |
| ID Cards | PUT | `/tenants/{id}/id-card-settings` | ✅ |
| Pages | GET | `/tenants/{id}/pages` | ✅ |
| Pages | GET | `/tenants/{id}/pages/{slug}` | ✅ |
| Pages | PUT | `/tenants/{id}/pages/{slug}` | ✅ |
| Pages | PATCH | `/tenants/{id}/pages/{slug}` | ✅ |
| Pages | DELETE | `/tenants/{id}/pages/{slug}` | ✅ |
| Reporters | GET | `/tenants/{id}/reporters` | ✅ |
| Reporters | GET | `/tenants/{id}/reporters/{id}` | ✅ |
| Reporters | POST | `/tenants/{id}/reporters` | ✅ |
| Reporters | PUT | `/tenants/{id}/reporters/{id}` | ✅ |
