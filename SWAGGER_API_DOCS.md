# Footer & Legal Pages - Complete Swagger API Documentation

## ✅ All APIs Now Fully Documented in Swagger

### 📋 Admin APIs (JWT Required)

#### **Static Pages Management**
All documented in `src/api/pages/tenantStaticPages.routes.ts`

| Method | Endpoint | Description | Tag |
|--------|----------|-------------|-----|
| GET | `/api/v1/tenants/{tenantId}/pages` | List all static pages for tenant | Tenant Static Pages |
| GET | `/api/v1/tenants/{tenantId}/pages/{slug}` | Get single page by slug | Tenant Static Pages |
| PUT | `/api/v1/tenants/{tenantId}/pages/{slug}` | Create/update page (upsert) | Tenant Static Pages |
| PATCH | `/api/v1/tenants/{tenantId}/pages/{slug}` | Partially update page | Tenant Static Pages |
| DELETE | `/api/v1/tenants/{tenantId}/pages/{slug}` | Delete page | Tenant Static Pages |

**Authorization:** SUPER_ADMIN or TENANT_ADMIN (scoped)

---

#### **Legal Pages Auto-Generation**
Documented in `src/api/settings/settings.routes.ts`

| Method | Endpoint | Description | Tag |
|--------|----------|-------------|-----|
| POST | `/api/v1/tenants/{tenantId}/domains/{domainId}/legal-pages/auto` | Auto-generate legal pages using AI | Settings (Admin) |

**Query Parameters:**
- `force` (boolean, default: false) - Regenerate even if pages exist

**Features:**
- AI-powered content generation
- Uses tenant context (TenantEntity + DomainSettings)
- Generates 6 pages: Privacy Policy, Terms, Disclaimer, About Us, Contact Us, Editorial Policy
- Bilingual support (English/Telugu)
- Legally compliant (Indian IT Act, Press Council)
- Skips existing pages (unless force=true)

**Authorization:** SUPER_ADMIN only

**Response Example:**
```json
{
  "success": true,
  "message": "Legal pages generated successfully",
  "generated": [
    "privacy-policy",
    "terms",
    "disclaimer",
    "about-us",
    "contact-us",
    "editorial-policy"
  ]
}
```

---

#### **Domain Settings with Auto-Legal**
Documented in `src/api/settings/settings.routes.ts`

| Method | Endpoint | Description | Tag |
|--------|----------|-------------|-----|
| PUT | `/api/v1/tenants/{tenantId}/domains/{domainId}/settings` | Create/update domain settings | Settings (Admin) |
| PATCH | `/api/v1/tenants/{tenantId}/domains/{domainId}/settings` | Partially update domain settings | Settings (Admin) |

**Query Parameters:**
- `autoSeo` (boolean, default: true) - Auto-generate SEO fields
- `autoLegal` (boolean, default: true) - Auto-generate legal pages

**Automatic Behavior:**
When `autoLegal=true` (default):
- Generates legal pages after saving domain settings
- Uses tenant entity data (publisher, editor, address, RNI)
- Uses domain settings data (branding, contact info)
- Skips pages that already exist

**Example:**
```bash
PUT /api/v1/tenants/{tenantId}/domains/{domainId}/settings?autoLegal=true
{
  "branding": {
    "siteName": "Kaburlu News"
  },
  "contact": {
    "email": "contact@kaburlu.com",
    "phone": "+91-9876543210"
  }
}

# Response includes saved settings
# Background: Legal pages automatically generated
```

---

### 🌐 Public APIs (No Authentication)

#### **Legal Pages Endpoints**
All documented in `src/api/public/website.routes.ts`

| Method | Endpoint | Description | Tags |
|--------|----------|-------------|------|
| GET | `/public/about-us` | Get About Us page | Public - Website, Legal Pages |
| GET | `/public/contact-us` | Get Contact Us page | Public - Website, Legal Pages |
| GET | `/public/privacy-policy` | Get Privacy Policy page | Public - Website, Legal Pages |
| GET | `/public/terms` | Get Terms of Service page | Public - Website, Legal Pages |
| GET | `/public/disclaimer` | Get Disclaimer page | Public - Website, Legal Pages |
| GET | `/public/editorial-policy` | Get Editorial Policy page | Public - Website, Legal Pages |

**Headers:**
- `X-Tenant-Domain` (optional) - For local testing, overrides tenant resolution

**Response Schema:**
```json
{
  "slug": "string",
  "title": "string",
  "contentHtml": "string (HTML content)",
  "meta": {
    "keywords": "string",
    "description": "string"
  },
  "updatedAt": "2026-01-18T10:00:00.000Z"
}
```

**Response Examples:**

<details>
<summary>Privacy Policy Example</summary>

```json
{
  "slug": "privacy-policy",
  "title": "Privacy Policy",
  "contentHtml": "<h1>Privacy Policy</h1><h2>Information Collection</h2><p>We collect personal information when you register, subscribe, or use our services...</p><h2>Use of Information</h2><p>We use your information to provide personalized content...</p>",
  "meta": {
    "keywords": "privacy, data protection, GDPR, user rights",
    "description": "Learn how we protect your privacy and handle your personal data"
  },
  "updatedAt": "2026-01-18T10:00:00.000Z"
}
```
</details>

<details>
<summary>About Us Example</summary>

```json
{
  "slug": "about-us",
  "title": "About Us",
  "contentHtml": "<h1>About Kaburlu News</h1><p>Established in 2020, we are committed to quality journalism...</p><h2>Our Mission</h2><p>Delivering truth with integrity and impact.</p>",
  "meta": {
    "keywords": "about, news, journalism, mission",
    "description": "Learn about Kaburlu News - our mission, team, and commitment to quality journalism"
  },
  "updatedAt": "2026-01-18T10:00:00.000Z"
}
```
</details>

**Status Codes:**
- `200` - Page found and returned
- `404` - Page not found or not published
- `500` - Domain context missing (tenant resolution failed)

---

#### **Settings with Footer Links**
Documented in `src/api/public/website.routes.ts`

| Method | Endpoint | Description | Tag |
|--------|----------|-------------|-----|
| GET | `/public/settings` | Get complete domain settings + footer links | Public - Website |

**Response Includes:**
```json
{
  "branding": { "logoUrl": "...", "siteName": "..." },
  "theme": { "primaryColor": "...", "secondaryColor": "..." },
  "navigation": { "menu": [...] },
  "seo": { "defaultMetaTitle": "...", "canonicalBaseUrl": "..." },
  "integrations": { "analytics": {...}, "social": {...} },
  "pages": {
    "static": [
      {
        "slug": "about-us",
        "label": "About Us",
        "endpoint": "/public/about-us",
        "available": true,
        "title": "About Us",
        "updatedAt": "2026-01-18T10:00:00.000Z"
      },
      {
        "slug": "contact-us",
        "label": "Contact Us",
        "endpoint": "/public/contact-us",
        "available": true,
        "title": "Contact Us",
        "updatedAt": "2026-01-18T10:00:00.000Z"
      },
      {
        "slug": "privacy-policy",
        "label": "Privacy Policy",
        "endpoint": "/public/privacy-policy",
        "available": true,
        "title": "Privacy Policy",
        "updatedAt": "2026-01-18T10:00:00.000Z"
      },
      {
        "slug": "terms",
        "label": "Terms",
        "endpoint": "/public/terms",
        "available": true,
        "title": "Terms of Service",
        "updatedAt": "2026-01-18T10:00:00.000Z"
      },
      {
        "slug": "disclaimer",
        "label": "Disclaimer",
        "endpoint": "/public/disclaimer",
        "available": true,
        "title": "Disclaimer",
        "updatedAt": "2026-01-18T10:00:00.000Z"
      },
      {
        "slug": "editorial-policy",
        "label": "Editorial Policy",
        "endpoint": "/public/editorial-policy",
        "available": true,
        "title": "Editorial Policy",
        "updatedAt": "2026-01-18T10:00:00.000Z"
      }
    ]
  }
}
```

**Usage:**
Frontend can fetch this once and get all footer links with availability status.

---

## 🎯 Swagger UI Access

After starting the dev server:

```bash
npm run dev
```

### Swagger Documentation URLs:

**API v1 Docs:**
```
http://localhost:8080/api/v1/docs
```

**Root-level Docs:**
```
http://localhost:8080/api/docs
```

---

## 📝 Swagger Tags Organization

All legal pages APIs are organized under these tags:

### **Admin APIs:**
- `Tenant Static Pages` - CRUD operations for static pages
- `Settings (Admin)` - Domain settings with auto-generation

### **Public APIs:**
- `Public - Website` - Public-facing endpoints
- `Legal Pages` - Specific legal page endpoints (NEW)

---

## 🔍 API Search in Swagger

**To find legal pages APIs in Swagger UI:**

1. Open Swagger UI at `/api/v1/docs`
2. Use the search/filter box
3. Search for:
   - "legal" - Shows all legal page endpoints
   - "pages" - Shows static pages management
   - "auto" - Shows auto-generation endpoints
   - "footer" - Shows footer-related endpoints

**Or filter by tags:**
- Click on "Legal Pages" tag to see all public legal endpoints
- Click on "Tenant Static Pages" to see admin CRUD
- Click on "Settings (Admin)" to see auto-generation

---

## 🚀 Quick Start Examples

### **1. Auto-Generate Legal Pages for New Domain**

```bash
# When creating domain settings
curl -X PUT "http://localhost:8080/api/v1/tenants/{tenantId}/domains/{domainId}/settings?autoLegal=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branding": { "siteName": "My News Site" },
    "contact": { "email": "contact@example.com" }
  }'

# Legal pages automatically generated in background
```

### **2. Manually Trigger Legal Pages Generation**

```bash
curl -X POST "http://localhost:8080/api/v1/tenants/{tenantId}/domains/{domainId}/legal-pages/auto?force=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **3. Frontend: Fetch Footer Links**

```typescript
// Get all settings including footer links
const settings = await fetch('/public/settings', {
  headers: { 'X-Tenant-Domain': 'news.kaburlu.com' }
}).then(r => r.json());

// Build footer
const footerLinks = settings.pages.static
  .filter(p => p.available)
  .map(page => ({
    href: page.endpoint,
    label: page.label
  }));

// Render footer
<footer>
  <div className="legal-links">
    {footerLinks.map(link => (
      <a key={link.href} href={link.href}>{link.label}</a>
    ))}
  </div>
</footer>
```

### **4. Frontend: Fetch Single Page**

```typescript
// Get privacy policy
const privacyPolicy = await fetch('/public/privacy-policy', {
  headers: { 'X-Tenant-Domain': 'news.kaburlu.com' }
}).then(r => r.json());

// Render HTML content
<div dangerouslySetInnerHTML={{ __html: privacyPolicy.contentHtml }} />
```

---

## ✅ Complete API Checklist

### **Admin APIs (Documented in Swagger):**
- [x] List static pages - `GET /tenants/{id}/pages`
- [x] Get page by slug - `GET /tenants/{id}/pages/{slug}`
- [x] Create/update page - `PUT /tenants/{id}/pages/{slug}`
- [x] Patch page - `PATCH /tenants/{id}/pages/{slug}`
- [x] Delete page - `DELETE /tenants/{id}/pages/{slug}`
- [x] Auto-generate legal pages - `POST /tenants/{id}/domains/{domainId}/legal-pages/auto`
- [x] Domain settings with auto-legal - `PUT /tenants/{id}/domains/{domainId}/settings`

### **Public APIs (Documented in Swagger):**
- [x] About Us - `GET /public/about-us`
- [x] Contact Us - `GET /public/contact-us`
- [x] Privacy Policy - `GET /public/privacy-policy`
- [x] Terms of Service - `GET /public/terms`
- [x] Disclaimer - `GET /public/disclaimer`
- [x] Editorial Policy - `GET /public/editorial-policy`
- [x] Settings with footer links - `GET /public/settings`

### **Supporting Features:**
- [x] AI-powered content generation
- [x] Tenant context collection (TenantEntity + DomainSettings)
- [x] Bilingual support (English/Telugu)
- [x] Legal compliance (Indian IT Act, Press Council)
- [x] Smart skipping (existing pages)
- [x] Response schemas with examples
- [x] Comprehensive error handling

---

## 📚 Related Documentation

- [FOOTER_AND_LEGAL_PAGES_GUIDE.md](FOOTER_AND_LEGAL_PAGES_GUIDE.md) - Complete implementation guide
- [TENANT_ADMIN_API_INTEGRATION.md](TENANT_ADMIN_API_INTEGRATION.md) - Admin dashboard integration
- [WEBSITE_API.md](WEBSITE_API.md) - Public website APIs

---

## 🎉 Summary

**All footer and legal pages APIs are now fully documented in Swagger with:**
- ✅ Complete request/response schemas
- ✅ Example payloads and responses
- ✅ Query parameters documented
- ✅ Authorization requirements specified
- ✅ Error responses documented
- ✅ Tags for easy filtering
- ✅ Searchable in Swagger UI

**Access Swagger UI at:**
- Development: `http://localhost:8080/api/v1/docs`
- Production: `https://your-domain.com/api/v1/docs`
