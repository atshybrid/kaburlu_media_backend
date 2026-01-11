# Next.js Frontend Integration Guide

This guide shows exactly how to integrate your Next.js website with the Kaburlu backend.

Backend global base URL (works for all tenants):
- https://app.kaburlumedia.com/api
- Versioned admin routes: https://app.kaburlumedia.com/api/v1

Two ways to call the API from the website:
- Recommended: Same-origin via rewrite (/api → backend). Simpler, no CORS, no headers.
- Alternative: Call global backend URL and send X-Tenant-Domain header.

---

## Option A — Recommended (Same-origin with rewrite)

1) Configure Next.js rewrite
```js
// next.config.js
module.exports = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'https://app.kaburlumedia.com/api/:path*' },
    ];
  },
};
```

2) Call using relative paths
```ts
// fetch
const res = await fetch('/api/public/categories?languageCode=te');
const data = await res.json();

// axios
import axios from 'axios';
export const api = axios.create({ baseURL: '/api' });
const { data: theme } = await api.get('/public/theme');
```

- Browser URL stays on https://{tenant-domain}/api/...
- Vercel proxies to https://app.kaburlumedia.com/api/...
- Tenant auto-resolves from Host (no X-Tenant-Domain header needed).
- No CORS config required.

---

## Option B — Global backend URL + tenant header

Use this when you cannot set a rewrite (external apps, scripts, etc.). For the website, prefer Option A.

1) Choose base URL
```
NEXT_PUBLIC_API_BASE_URL=https://app.kaburlumedia.com/api
```

2) Send X-Tenant-Domain header
- Client (browser): derive from window.location.hostname
- Server (SSR/App Router): derive from request host header

### App Router (Next.js 13+) examples

Server Component (fetch):
```ts
import { headers } from 'next/headers';

export default async function Page() {
  const host = headers().get('host')!; // e.g., kaburlumedia.com
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/public/categories?languageCode=te`,
    { headers: { 'X-Tenant-Domain': host }, cache: 'no-store' }
  );
  const categories = await res.json();
  return <pre>{JSON.stringify(categories, null, 2)}</pre>;
}
```

Client Component (axios instance):
```ts
'use client';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    config.headers = config.headers || {};
    config.headers['X-Tenant-Domain'] = window.location.hostname; // kaburlumedia.com
  }
  return config;
});

export async function getTheme() {
  const { data } = await api.get('/public/theme');
  return data;
}
```

### Pages Router (getServerSideProps) example
```ts
export async function getServerSideProps({ req }) {
  const host = req.headers['x-forwarded-host'] || req.headers.host; // kaburlumedia.com
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL}/public/articles?categorySlug=politics&page=1&pageSize=20`,
    { headers: { 'X-Tenant-Domain': String(host) } }
  );
  const data = await res.json();
  return { props: { data } };
}
```

CORS reminder:
- If you use Option B from the browser, your backend must allow your site origin and the custom header:
  - Set env `CORS_ORIGINS=https://kaburlumedia.com,https://www.kaburlumedia.com` (plus any others)
  - Backend already allows `X-Tenant-Domain` in `allowedHeaders`.

---

## Website endpoints you’ll use

- Theme: `GET /api/public/theme`
- Categories: `GET /api/public/categories?languageCode=te`
- Articles list: `GET /api/public/articles?categorySlug=...&page=1&pageSize=20&languageCode=te`
- Article detail: `GET /api/public/articles/{slug}`
- Health: `GET /api/public/_health`

These are tenant-aware (resolved from Host in Option A, or from the header in Option B).

### Minimal TypeScript shapes (for frontend)
```ts
export type TenantTheme = {
  id: string; tenantId: string;
  logoUrl?: string; faviconUrl?: string; primaryColor?: string; headerHtml?: string;
  createdAt: string; updatedAt: string;
};

export type Category = { id: string; name: string; slug: string; parentId?: string | null; iconUrl?: string | null };

export type Article = {
  id: string; title: string; shortNews?: string | null; longNews?: string | null; headlines?: string | null;
  images?: string[]; categories: Category[]; createdAt: string;
};

export type ArticleList = { page: number; pageSize: number; total: number; items: Article[] };
```

### Card mapping helper
```ts
export type ArticleCard = {
  id: string; title: string; image: string | null; excerpt: string | null; category: string | null; createdAt: string;
};

export function toCard(a: Article): ArticleCard {
  return {
    id: a.id,
    title: a.title,
    image: a.images?.[0] ?? null,
    excerpt: a.shortNews ?? null,
    category: a.categories?.[0]?.slug ?? null,
    createdAt: a.createdAt,
  };
}
```

---

## Quick test checklist

- Option A (rewrite):
  - Open in browser: `https://kaburlumedia.com/api/public/_health` and `.../categories?languageCode=te`
- Option B (global):
  - Curl: `curl "https://app.kaburlumedia.com/api/public/categories?languageCode=te" -H "X-Tenant-Domain: kaburlumedia.com"`
  - Ensure backend CORS allows your site origin.

---

## Notes
- Public endpoints require no auth. Admin endpoints live under `/api/v1` and use `Authorization: Bearer <token>`.
- Article detail currently matches by title or id. If you want a real `slug` field, request it and we’ll add a migration + wire-up.
- Prefer Option A for websites: simpler, more secure defaults, and CDN-friendly.

---

# Next.js Admin Panel — Tenant Setup Wizard (End-to-end)

This section maps a practical “Create Tenant → Complete Website Setup” wizard into exact backend calls.

Two common deployment models:
- **Model 1: SUPER_ADMIN Console** (you/ops team creates & verifies tenants/domains/settings)
- **Model 2: TENANT_ADMIN Self-serve** (publisher sets most tenant config; SUPER_ADMIN only verifies domain + sets kind/categories/settings if restricted)

You said your admin app is **SUPER_ADMIN**. That means your UI can implement the entire flow end-to-end (including domain verification/kind/categories and settings).

Important routing note:
- Use **versioned admin base**: `https://app.kaburlumedia.com/api/v1`
- Most admin routers are also mounted on legacy paths, but the admin UI should stick to `/api/v1`.

## Wizard state you should store client-side
- `tenantId`
- `primaryDomainId`, `primaryDomain` (string)
- optional: `epaperDomainId`, `epaperDomain`
- `languageId` (for TenantEntity)

Recommended extra state for SUPER_ADMIN console:
- `verifyInstruction` from domain creation (TXT record details)
- optional: `selectedStyle` (`style1` or `style2`)

---

## Permissions matrix (SUPER_ADMIN console)
In this repo:
- **SUPER_ADMIN only**
  - Create tenant: `POST /api/v1/tenants`
  - Domain verify/kind/categories: `POST /api/v1/domains/:id/verify`, `PATCH /api/v1/domains/:id/kind`, `PUT /api/v1/domains/:id/categories`
  - Settings layer: `GET/PUT/PATCH /api/v1/entity/settings`, `.../tenants/:tenantId/settings`, `.../tenants/:tenantId/domains/:domainId/settings`
- **SUPER_ADMIN or TENANT_ADMIN scoped** (still fine for SUPER_ADMIN app)
  - TenantEntity upsert: `POST /api/v1/tenants/:tenantId/entity` and `/entity/simple`
  - Add domain: `POST /api/v1/tenants/:tenantId/domains`
  - Theme/homepage config: `/api/v1/tenant-theme/...`
  - Ads config: `/api/v1/tenants/:tenantId/ads/style1|style2`

---

## Suggested Next.js admin page flow (wizard screens)
This is a practical screen-to-API mapping you can implement:

1) **Tenant**
  - Form: name, slug, prgiNumber, stateId
  - Call: `POST /api/v1/tenants`
  - Store: `tenantId`
2) **Entity (PRGI details)**
  - Form (minimal): languageId, periodicity, registrationDate, publisherName, nativeName
  - Call: `POST /api/v1/tenants/:tenantId/entity/simple`
3) **Domains**
  - Form: primary domain, optional epaper domain
  - Call: `POST /api/v1/tenants/:tenantId/domains` (for each)
  - Show: `verifyInstruction` (TXT record name/value)
4) **Verify & Kind**
  - Action buttons: Verify primary domain; Verify epaper domain
  - Call: `POST /api/v1/domains/:domainId/verify`
  - Call: `PATCH /api/v1/domains/:domainId/kind` (NEWS for primary, EPAPER for epaper)
5) **Categories**
  - UI: pick slugs (recommended) or ids
  - Call: `PUT /api/v1/domains/:domainId/categories`
6) **Homepage**
  - Choose style: style1 or style2
  - Call apply default: `POST /api/v1/tenant-theme/:tenantId/homepage/:style/apply-default`
  - Optional: `PATCH .../sections` to set categorySlug/categorySlugs + labels
7) **Ads**
  - Configure style1/style2 slots
  - Call: `PUT /api/v1/tenants/:tenantId/ads/style1` and/or `.../style2`
8) **Preview**
  - Use public endpoints with `X-Tenant-Domain` and show results

---

## Minimal Next.js admin calling pattern (SUPER_ADMIN)
If you don’t want to expose the SUPER_ADMIN JWT to the browser, proxy calls through your Next.js server.

Option 1 (recommended): Next.js Route Handler proxies → backend
```ts
// app/api/admin/[...path]/route.ts
import { NextRequest } from 'next/server';

const BACKEND = process.env.BACKEND_BASE_URL!; // e.g. https://app.kaburlumedia.com/api/v1

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  const url = new URL(req.url);
  const upstream = `${BACKEND}/${ctx.params.path.join('/')}${url.search}`;
  const token = req.headers.get('authorization') || ''; // or read from cookies/session
  const res = await fetch(upstream, { headers: { Authorization: token } });
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } });
}
```

Then call from your UI:
```ts
await fetch('/api/admin/tenants', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ name, slug, prgiNumber, stateId })
});
```

Option 2: Admin UI calls backend directly
- Only do this if you’re OK storing SUPER_ADMIN auth in browser storage.
- Use `baseURL = https://app.kaburlumedia.com/api/v1`.

## Step 0 — Auth
- All admin calls require `Authorization: Bearer <JWT>`.
- Tenant-resolved public preview calls can use `X-Tenant-Domain: <domain>`.

---

## Step 1 — Create tenant (SUPER_ADMIN only)
Endpoint:
- `POST /api/v1/tenants`

Request:
```bash
curl -X POST "$BASE/api/v1/tenants" \
  -H "Authorization: Bearer $JWT_SUPERADMIN" -H "Content-Type: application/json" \
  -d '{"name":"Prashna News","slug":"prashna","prgiNumber":"PRGI-2025-010","stateId":"cmstate123"}'
```

Response (store `id` as `tenantId`):
```json
{ "id": "...", "name": "Prashna News", "slug": "prashna", "prgiNumber": "PRGI-2025-010", "stateId": "cmstate123" }
```

If you are doing **TENANT_ADMIN self-serve**, this step is typically done by SUPER_ADMIN beforehand.

---

## Step 2 — Create TenantEntity (publisher/PRGI) (TENANT_ADMIN scoped or SUPER_ADMIN)
Recommended onboarding endpoint (simple + optional admin user creation):
- `POST /api/v1/tenants/:tenantId/entity/simple`

Request:
```bash
curl -X POST "$BASE/api/v1/tenants/$TENANT_ID/entity/simple" \
  -H "Authorization: Bearer $JWT_TENANT_ADMIN_OR_SUPER" -H "Content-Type: application/json" \
  -d '{
    "languageId":"lang_te_id",
    "nativeName":"ప్రశ్నాయుధం",
    "periodicity":"DAILY",
    "registrationDate":"04/09/2025",
    "publisherName":"Some Publisher",
    "adminMobile":"9876543210"
  }'
```

Notes:
- `languageId` is mandatory.
- If `nativeName` is omitted, backend may auto-generate a native script name.

---

## Step 3 — Add domains (TENANT_ADMIN scoped or SUPER_ADMIN)
Endpoint:
- `POST /api/v1/tenants/:tenantId/domains`

Rules enforced server-side:
- At most **2** domains per tenant
- Only **one** primary domain (`isPrimary=true`)
- Only **one** epaper subdomain, and it must start with `epaper.`

Create primary domain:
```bash
curl -X POST "$BASE/api/v1/tenants/$TENANT_ID/domains" \
  -H "Authorization: Bearer $JWT_TENANT_ADMIN_OR_SUPER" -H "Content-Type: application/json" \
  -d '{"domain":"news.example.com","isPrimary":true}'
```

Response includes DNS TXT verification instructions:
```json
{
  "domain": { "id": "...", "domain": "news.example.com", "status": "PENDING", "isPrimary": true },
  "verifyInstruction": { "type": "DNS_TXT", "name": "_kaburlu-verify.news.example.com", "value": "<token>" }
}
```

Optional epaper domain:
```bash
curl -X POST "$BASE/api/v1/tenants/$TENANT_ID/domains" \
  -H "Authorization: Bearer $JWT_TENANT_ADMIN_OR_SUPER" -H "Content-Type: application/json" \
  -d '{"domain":"epaper.news.example.com","isPrimary":false}'
```

Store `domain.id` as `primaryDomainId` / `epaperDomainId`.

---

## Step 4 — Verify domain + set kind (SUPER_ADMIN)
These are ops/superadmin steps in most setups.

Verify:
- `POST /api/v1/domains/:domainId/verify`

```bash
curl -X POST "$BASE/api/v1/domains/$DOMAIN_ID/verify" \
  -H "Authorization: Bearer $JWT_SUPERADMIN" -H "Content-Type: application/json" \
  -d '{"method":"MANUAL"}'
```

Set kind:
- `PATCH /api/v1/domains/:domainId/kind` with `{ "kind": "NEWS" | "EPAPER" }`

```bash
curl -X PATCH "$BASE/api/v1/domains/$DOMAIN_ID/kind" \
  -H "Authorization: Bearer $JWT_SUPERADMIN" -H "Content-Type: application/json" \
  -d '{"kind":"NEWS"}'
```

---

## Step 5 — Set domain categories (SUPER_ADMIN)
Endpoint:
- `PUT /api/v1/domains/:domainId/categories`

Request (recommended using slugs):
```bash
curl -X PUT "$BASE/api/v1/domains/$DOMAIN_ID/categories" \
  -H "Authorization: Bearer $JWT_SUPERADMIN" -H "Content-Type: application/json" \
  -d '{"categorySlugs":["national","international","politics"],"createIfMissingTranslations":true}'
```

---

## Step 6 — Configure website homepage (Style1 / Style2) (TENANT_ADMIN scoped or SUPER_ADMIN)
Endpoints:
- `POST /api/v1/tenant-theme/:tenantId/homepage/:style/apply-default`
- `PATCH /api/v1/tenant-theme/:tenantId/homepage/:style/sections`

Style1 example:
```bash
curl -X POST "$BASE/api/v1/tenant-theme/$TENANT_ID/homepage/style1/apply-default" \
  -H "Authorization: Bearer $JWT_TENANT_ADMIN_OR_SUPER"

curl -X PATCH "$BASE/api/v1/tenant-theme/$TENANT_ID/homepage/style1/sections" \
  -H "Authorization: Bearer $JWT_TENANT_ADMIN_OR_SUPER" -H "Content-Type: application/json" \
  -d '{"sections":[
    {"key":"lastNews","categorySlug":"politics","limit":10},
    {"key":"trendingCategory","categorySlug":"sports"}
  ]}'
```

Style2 (unified config API):
```bash
curl -X POST "$BASE/api/v1/tenant-theme/$TENANT_ID/style2-config/apply-default" \
  -H "Authorization: Bearer $JWT_TENANT_ADMIN_OR_SUPER"
```

---

## Step 7 — Configure ads (Style1 / Style2) (TENANT_ADMIN scoped or SUPER_ADMIN)
Endpoints:
- `GET/PUT/PATCH /api/v1/tenants/:tenantId/ads/style1`
- `GET/PUT/PATCH /api/v1/tenants/:tenantId/ads/style2`

Style1 Google Adsense example:
```bash
curl -X PUT "$BASE/api/v1/tenants/$TENANT_ID/ads/style1" \
  -H "Authorization: Bearer $JWT_TENANT_ADMIN_OR_SUPER" -H "Content-Type: application/json" \
  -d '{"ads":{"enabled":true,"googleAdsense":{"client":"ca-pub-123"},"slots":{"home_top_banner":{"enabled":true,"provider":"google","google":{"slot":"1000000001","format":"auto","responsive":true}}}}}'
```

---

## Step 8 — Optional: feature flags + Razorpay (TENANT_ADMIN scoped or SUPER_ADMIN)
Feature flags:
- `GET /api/v1/tenants/:tenantId/feature-flags`
- `PATCH /api/v1/tenants/:tenantId/feature-flags`

Razorpay keys:
- `GET/POST/PUT /api/v1/tenants/:tenantId/razorpay-config`

---

## Step 9 — Public preview (works before frontend is complete)
Use these from the wizard “Preview” step (send `X-Tenant-Domain`).

```bash
curl "$BASE/public/homepage?shape=style1" -H "X-Tenant-Domain: news.example.com"
curl "$BASE/public/homepage?shape=style2&v=2" -H "X-Tenant-Domain: news.example.com"
curl "$BASE/public/ads/style1" -H "X-Tenant-Domain: news.example.com"
curl "$BASE/public/navigation" -H "X-Tenant-Domain: news.example.com"
```

If any public preview returns `Domain context missing`, the domain isn’t resolved (verify domain status/host/header), or the tenant resolver can’t map it.
