# Website (Tenant) API Guide

This guide shows how your Next.js frontend should call the backend for tenant websites using the public, domain-aware APIs.

## Base URL strategy

- Best practice (recommended): Use a rewrite on Vercel so the browser calls your tenant domain and Vercel proxies to the backend.
  - In Next.js:
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
  - Then in the frontend, always call relative paths like `/api/public/...`.
  - Tenant is resolved automatically from the request host (no extra headers; no CORS needed).

- Alternative (for external clients): Call the global backend URL and set the tenant header.
  - Base: `https://app.kaburlumedia.com/api`
  - Header: `X-Tenant-Domain: kaburlumedia.com`

## Public Website APIs (tenant-aware)

All paths below are relative to your website domain (after the rewrite):

1) GET `/api/public/theme`
- Purpose: Fetch branding for the current tenant (logo, colors, etc.).
- Response (example):
  ```json
  {
    "id": "tt_123",
    "tenantId": "t_abc",
    "logoUrl": "https://.../logo.png",
    "faviconUrl": "https://.../favicon.ico",
    "primaryColor": "#e91e63",
    "headerHtml": "<div>...</div>",
    "createdAt": "2025-11-06T10:00:00.000Z",
    "updatedAt": "2025-11-06T10:00:00.000Z"
  }
  ```

2) GET `/api/public/categories?languageCode=te`
- Purpose: Navigation categories allowed for this domain.
- Query:
  - `languageCode` (optional): e.g., `te`. If allowed for this domain, names are translated.
  - `includeChildren` (optional): `true` to include immediate children (still filtered to allowed set).
- Response (example item):
  ```json
  { "id": "cat_1", "name": "రాజకీయాలు", "slug": "politics", "parentId": null, "iconUrl": null }
  ```

3) GET `/api/public/articles?categorySlug=politics&page=1&pageSize=20&languageCode=te`
- Purpose: List published articles for listing pages.
- Query:
  - `categorySlug` (optional)
  - `page` (default 1), `pageSize` (default 20, max 100)
  - `languageCode` (optional; must be allowed for this domain)
- Response (shape):
  ```json
  {
    "page": 1,
    "pageSize": 20,
    "total": 57,
    "items": [
      {
        "id": "a_1",
        "title": "Breaking News",
        "shortNews": "Short summary...",
        "longNews": null,
        "headlines": null,
        "type": "reporter",
        "author": { "id": "u_1", "mobileNumber": "+91..." },
        "language": { "id": "lang_te", "code": "te" },
        "tenant": { "id": "t_abc", "slug": "kaburlu" },
        "categories": [{ "id": "cat_1", "name": "రాజకీయాలు", "slug": "politics" }],
        "tags": ["tag1"],
        "images": ["https://.../image.jpg"],
        "isBreakingNews": false,
        "isTrending": true,
        "viewCount": 120,
        "createdAt": "2025-11-06T10:00:00.000Z",
        "updatedAt": "2025-11-06T10:00:00.000Z",
        "contentJson": null
      }
    ]
  }
  ```

4) GET `/api/public/articles/{slug}`
- Purpose: Article detail page. Currently matches by title or id (slug field can be added later).
- Response: Article object (same fields as in the list `items`).

5) GET `/api/public/_health`
- Purpose: Quick connectivity check.

## Frontend usage examples

- Fetch API (browser or server component):
  ```js
  const res = await fetch('/api/public/categories?languageCode=te', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load categories');
  const categories = await res.json();
  ```

- Axios wrapper:
  ```ts
  import axios from 'axios';
  export const api = axios.create({ baseURL: '/api' });

  export async function getTheme() {
    const { data } = await api.get('/public/theme');
    return data;
  }

  export async function listArticles(params: { categorySlug?: string; page?: number; pageSize?: number; languageCode?: string }) {
    const { data } = await api.get('/public/articles', { params });
    return data;
  }
  ```

- Building a card UI from the list response:
  ```ts
  type ArticleCard = {
    id: string;
    title: string;
    image: string | null;
    excerpt: string | null;
    category: string | null; // slug
    createdAt: string;
  };

  function toCard(a: any): ArticleCard {
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

## Troubleshooting & Tips

- If `/api/public/...` returns `Domain context missing` (500): you may be opening a vercel.app preview that isn’t mapped to a tenant. Test with the real custom domain or temporarily send the header `X-Tenant-Domain` when calling the global backend URL.
- Use `cache: 'no-store'` for dynamic pages; or rely on ISR/SSR per your Next.js strategy.
- `languageCode` must be allowed for the domain; otherwise you’ll get untranslated names (categories) or empty results (articles).

---
If you want a dedicated `article.slug` field and a compact `card` response directly from the API, ask and we’ll add the migration + endpoint shape for an even simpler frontend.
