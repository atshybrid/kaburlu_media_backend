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
