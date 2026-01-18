# Footer & Legal Pages - Complete Implementation Guide

## 🎯 Summary of Your Questions & Solutions

### 1️⃣ **Which API handles Footer Data?**

**ANSWER: Domain Settings API**

```bash
# Upsert domain settings (auto-generates legal pages by default)
PUT /api/v1/tenants/{tenantId}/domains/{domainId}/settings?autoLegal=true

# Manually trigger legal pages generation
POST /api/v1/tenants/{tenantId}/domains/{domainId}/legal-pages/auto?force=false
```

**Public API (Frontend):**
```bash
# Get footer links metadata
GET /public/settings

# Individual pages
GET /public/privacy-policy
GET /public/terms
GET /public/disclaimer
GET /public/about-us
GET /public/contact-us
GET /public/editorial-policy
```

---

### 2️⃣ **RSS Feeds - Are They Working?**

**❌ NO RSS Implementation Found**

**Current Situation:**
- ✅ JSON feeds available (`/public/homepage`, `/public/latest`, `/public/category/{slug}`)
- ✅ XML sitemap (`/public/sitemap.xml` for NEWS, `/sitemap.xml` for ePaper)
- ❌ **NO RSS/Atom feed endpoints**

**Recommendation:**
Create RSS feed generator at `/public/rss.xml` using `TenantWebArticle` (similar to sitemap implementation).

**Future Implementation:**
```typescript
// Potential endpoint
GET /public/rss.xml - Main RSS feed (latest articles)
GET /public/category/{slug}/rss.xml - Category-specific RSS feed
GET /public/rss.xml?lang=te - Language-specific RSS feed
```

---

### 3️⃣ **Mobile App - Show/Hide Flag**

**✅ ALREADY EXISTS**

**Database Field:**
- `TenantFeatureFlags.enableMobileAppView`

**Public API:**
```bash
GET /public/features
# Returns: { enableMobileAppView: true, ... }
```

**Admin API:**
```bash
PATCH /api/v1/tenants/{tenantId}/feature-flags
{
  "enableMobileAppView": true
}
```

**Frontend Integration:**
```typescript
const features = await fetch('/public/features').then(r => r.json());

if (features.enableMobileAppView) {
  // Show mobile app download section in footer
  <div className="mobile-app-download">
    <a href="https://play.google.com/...">Download on Google Play</a>
    <a href="https://apps.apple.com/...">Download on App Store</a>
  </div>
}
```

---

### 4️⃣ **Website Integration - Which Public API?**

**Frontend should use these PUBLIC APIs:**

#### **Settings & Configuration:**
```bash
GET /public/settings
# Returns: branding, theme, navigation, seo, pages.static[], integrations
```

#### **Legal Pages (Footer Links):**
```bash
GET /public/about-us
GET /public/contact-us
GET /public/privacy-policy
GET /public/terms
GET /public/disclaimer
GET /public/editorial-policy
```

#### **Navigation:**
```bash
GET /public/navigation
# Returns: brand, primaryLinks, socialLinks, mobile config
```

#### **Feature Flags:**
```bash
GET /public/features
# Returns: enableMobileAppView, enableComments, etc.
```

**Example Footer Component:**
```typescript
const settings = await fetch('/public/settings').then(r => r.json());
const pages = settings.pages?.static || [];

// Footer structure
<footer>
  <div className="footer-legal">
    {pages
      .filter(p => p.available)
      .map(page => (
        <a key={page.slug} href={page.endpoint}>
          {page.label}
        </a>
      ))}
  </div>
  
  {features.enableMobileAppView && (
    <div className="footer-apps">
      {/* Mobile app download links */}
    </div>
  )}
  
  <div className="footer-social">
    {settings.integrations?.social?.links?.map(link => (
      <a href={link.url}>{link.platform}</a>
    ))}
  </div>
</footer>
```

---

### 5️⃣ **Auto-Generate Legal Pages When Domain Created**

**✅ IMPLEMENTED - AI-Powered Legal Pages Generator**

## 🚀 How It Works

### **Automatic Generation (Default):**

When you create or update domain settings, legal pages are auto-generated:

```bash
PUT /api/v1/tenants/{tenantId}/domains/{domainId}/settings
{
  "branding": {
    "siteName": "Kaburlu News"
  },
  "seo": {
    "canonicalBaseUrl": "https://news.kaburlu.com"
  }
}

# By default: autoSeo=true AND autoLegal=true
# Legal pages automatically generated using AI
```

### **Manual Trigger:**

```bash
POST /api/v1/tenants/{tenantId}/domains/{domainId}/legal-pages/auto?force=false
```

### **Disable Auto-Generation:**

```bash
PUT /api/v1/tenants/{tenantId}/domains/{domainId}/settings?autoLegal=false
{
  // your settings
}
```

---

## 🧠 AI Context Used for Generation

The AI collects data from:

### **TenantEntity:**
- `prgiNumber` (RNI registration)
- `publisherName`
- `editorName`
- `ownerName`
- `address`
- `publicationCountry`, `publicationState`, `publicationDistrict`

### **DomainSettings:**
- `branding.siteName`
- `seo.canonicalBaseUrl`
- `contact.email`, `contact.phone`, `contact.officeAddress`
- `language` (supports bilingual for Telugu)

### **Domain:**
- `domain.domain` (e.g., news.kaburlu.com)
- `domain.kind` (NEWS vs EPAPER - different content)

---

## 📄 Pages Generated

1. **Privacy Policy**
   - Information collection (cookies, analytics, user data)
   - GDPR/DPDP Act compliance (for Indian sites)
   - User rights (access, deletion)
   - Security measures
   - Contact for privacy inquiries

2. **Terms of Service**
   - Acceptance of terms
   - User accounts & responsibilities
   - Intellectual property (© publisher)
   - Governing law (Indian jurisdiction for domestic)
   - Content accuracy disclaimers

3. **Disclaimer**
   - General information disclaimer
   - Accuracy limitations
   - No professional advice
   - External links disclaimer
   - Press Council compliance (India)

4. **About Us**
   - Site introduction & mission
   - Team (Editor, Publisher)
   - Coverage areas
   - RNI registration info
   - Contact details

5. **Contact Us**
   - General inquiries email
   - Phone number
   - Office address
   - Social media placeholders
   - News tips email (for NEWS sites)

6. **Editorial Policy**
   - Journalistic principles
   - Fact-checking process
   - Corrections policy
   - Editorial independence
   - Press Council norms (India)

---

## 🎨 Content Features

### **Personalized:**
- Uses actual publisher name, editor name, address
- Includes RNI registration number (if available)
- Site-specific mission and values

### **Legally Compliant:**
- Indian IT Act compliance (for domestic sites)
- Press Council of India guidelines
- GDPR/DPDP Act references
- Professional legal tone

### **Bilingual Support:**
- English by default
- Telugu + English (bilingual) if language=te
- Proper legal terminology in both languages

### **Smart Skipping:**
- Skips pages that already exist
- Use `force=true` to regenerate
- Preserves user-edited content (unless force=true)

---

## 🔧 Database Schema

```prisma
model TenantStaticPage {
  id              String   @id @default(cuid())
  tenantId        String
  slug            String   // privacy-policy, terms, etc.
  title           String?
  contentHtml     String   // Full HTML content
  meta            Json?    // SEO metadata
  published       Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([tenantId, slug])
  @@index([slug])
}
```

---

## 📊 Footer Data Best Practice

### **Recommended Footer Structure:**

```json
{
  "footer": {
    "legal": [
      { "slug": "privacy-policy", "label": "Privacy Policy", "endpoint": "/public/privacy-policy" },
      { "slug": "terms", "label": "Terms of Service", "endpoint": "/public/terms" },
      { "slug": "disclaimer", "label": "Disclaimer", "endpoint": "/public/disclaimer" },
      { "slug": "editorial-policy", "label": "Editorial Policy", "endpoint": "/public/editorial-policy" }
    ],
    "company": [
      { "slug": "about-us", "label": "About Us", "endpoint": "/public/about-us" },
      { "slug": "contact-us", "label": "Contact Us", "endpoint": "/public/contact-us" }
    ],
    "social": {
      "facebook": "https://facebook.com/kaburlu",
      "twitter": "https://twitter.com/kaburlu",
      "instagram": "https://instagram.com/kaburlu",
      "youtube": "https://youtube.com/@kaburlu"
    },
    "apps": {
      "enabled": true,  // From TenantFeatureFlags.enableMobileAppView
      "android": "https://play.google.com/store/apps/details?id=com.kaburlu",
      "ios": "https://apps.apple.com/app/kaburlu/id123456789"
    },
    "newsletter": {
      "enabled": true,  // From TenantFeatureFlags.enableNewsletter
      "endpoint": "/api/v1/newsletter/subscribe"
    },
    "copyright": "© 2026 Kaburlu Media. All rights reserved.",
    "rni": "APTEL/2020/12345",  // From TenantEntity.prgiNumber
    "contact": {
      "email": "contact@kaburlu.com",
      "phone": "+91-9876543210",
      "address": "123 Press Road, Hyderabad, Telangana 500001"
    }
  }
}
```

---

## ✅ Implementation Checklist

### **Backend (Completed):**
- [x] AI-powered legal pages generator (`src/lib/legalPagesAuto.ts`)
- [x] Auto-generation on domain settings update
- [x] Manual trigger endpoint (`POST /legal-pages/auto`)
- [x] Public API endpoints for each page
- [x] Footer links in `/public/settings`
- [x] Feature flag for mobile app view
- [x] Swagger API documentation

### **Frontend (To Do):**
- [ ] Create RSS feed endpoint (`/public/rss.xml`)
- [ ] Footer component using `/public/settings`
- [ ] Conditional mobile app section (based on `enableMobileAppView`)
- [ ] Legal pages UI (render HTML from API)
- [ ] Newsletter subscription form (if enabled)
- [ ] Social media links (from integrations)

---

## 🎉 Summary

**All 5 questions answered:**

1. ✅ **Footer API:** Domain Settings + Public Settings API
2. ❌ **RSS:** Not implemented (needs creation)
3. ✅ **Mobile App Flag:** `TenantFeatureFlags.enableMobileAppView`
4. ✅ **Public API:** `/public/settings`, `/public/{page}`, `/public/features`
5. ✅ **Auto Legal Pages:** AI-powered generation using tenant context

**New Features Added:**
- Automatic legal pages generation on domain creation
- AI uses TenantEntity + DomainSettings for personalization
- Bilingual support (English/Telugu)
- Legal compliance (Indian IT Act, Press Council)
- Manual trigger endpoint for regeneration
