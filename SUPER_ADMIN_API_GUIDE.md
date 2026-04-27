# Super Admin — Complete API Guide
### Flow-wise, Step-by-Step, with Payloads, Responses & Next.js Integration

> **Base URL:** `https://your-api.com/api/v1`  
> **Auth:** Bearer JWT token in `Authorization: Bearer <token>` header  
> **Docs (live):** `https://your-api.com/api/v1/docs`

---

## 📋 Table of Contents

1. [Authentication — Login as Super Admin](#1-authentication)
2. [Tenant Management](#2-tenant-management)
3. [Tenant Admin Management](#3-tenant-admin-management)
4. [Domain Management](#4-domain-management)
5. [Settings (Entity / Tenant / Domain)](#5-settings)
6. [Journalist Union — Super Admin](#6-journalist-union-super-admin)
7. [Journalist Union — Admin (Union Admin Flow)](#7-journalist-union-admin-flow)
8. [AI Usage & Billing](#8-ai-usage--billing)
9. [Razorpay Config](#9-razorpay-config)
10. [Next.js Integration Pattern](#10-nextjs-integration-pattern)

---

## 1. Authentication

### Step 1 — Login

```
POST /auth/login
```

**Payload:**
```json
{
  "mobileNumber": "9876543210",
  "mpin": "1234"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_abc123",
    "mobileNumber": "9876543210",
    "role": { "name": "SUPER_ADMIN" }
  }
}
```

**Next.js — store token:**
```typescript
// lib/auth.ts
export const login = async (mobile: string, mpin: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNumber: mobile, mpin }),
  });
  const data = await res.json();
  // Store in httpOnly cookie via /api/auth route (recommended) or localStorage
  localStorage.setItem('token', data.token);
  return data;
};

// Reusable auth header helper
export const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});
```

---

## 2. Tenant Management

> A **Tenant** = one news organization (e.g. "TV9 Andhra", "Sakshi"). Each tenant has its own reporters, domains, categories, settings.

### 2.1 List All Tenants

```
GET /api/v1/tenants
```

**Response:**
```json
[
  {
    "id": "tenant_abc",
    "name": "TV9 Andhra",
    "slug": "tv9-andhra",
    "active": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
]
```

### 2.2 Create Tenant

```
POST /api/v1/tenants
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "name": "Sakshi Media",
  "slug": "sakshi-media",
  "languageId": "lang_telugu_id",
  "active": true
}
```

**Response:**
```json
{
  "id": "tenant_new123",
  "name": "Sakshi Media",
  "slug": "sakshi-media",
  "active": true
}
```

### 2.3 Update Tenant

```
PATCH /api/v1/tenants/:id
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "active": false,
  "name": "Sakshi Media Network"
}
```

### 2.4 Get Single Tenant

```
GET /api/v1/tenants/:id
```

### 2.5 Add Domain to Tenant

```
POST /api/v1/tenants/:tenantId/domains
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "domain": "sakshi.com",
  "kind": "NEWS",
  "active": true
}
```

**Response:**
```json
{
  "id": "domain_xyz",
  "domain": "sakshi.com",
  "kind": "NEWS",
  "verified": false,
  "tenantId": "tenant_new123"
}
```

### 2.6 Feature Flags (per-tenant)

```
PATCH /api/v1/tenants/:tenantId/feature-flags
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "EPAPER_ENABLED": true,
  "AI_REWRITE_ENABLED": true,
  "WALLET_ENABLED": false
}
```

---

## 3. Tenant Admin Management

> Tenant Admins manage reporters, articles, settings for ONE tenant.

### Full Flow: Create → List → Update → Delete

#### Step 1 — Create Tenant Admin

```
POST /api/v1/tenant-admins
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "mobileNumber": "9000011111",
  "name": "Ravi Kumar",
  "tenantId": "tenant_abc",
  "mpin": "5678"
}
```

**Response:**
```json
{
  "id": "user_new456",
  "mobileNumber": "9000011111",
  "tenantAdminProfile": {
    "tenantId": "tenant_abc",
    "active": true
  }
}
```

#### Step 2 — List All Tenant Admins

```
GET /api/v1/tenant-admins
Authorization: Bearer <superadmin_token>
```

**Response:**
```json
[
  {
    "id": "user_new456",
    "mobileNumber": "9000011111",
    "profile": { "fullName": "Ravi Kumar" },
    "tenantAdmin": {
      "tenantId": "tenant_abc",
      "active": true,
      "tenant": { "name": "TV9 Andhra" }
    }
  }
]
```

#### Step 3 — Get Single Tenant Admin

```
GET /api/v1/tenant-admins/:userId
Authorization: Bearer <superadmin_token>
```

#### Step 4 — Update Tenant Admin

```
PUT /api/v1/tenant-admins/:userId
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "active": false,
  "tenantId": "tenant_different"
}
```

#### Step 5 — Delete Tenant Admin

```
DELETE /api/v1/tenant-admins/:userId
Authorization: Bearer <superadmin_token>
```

**Response:**
```json
{ "message": "Tenant admin deleted" }
```

---

## 4. Domain Management

### 4.1 Verify Domain (go live)

```
POST /api/v1/domains/:id/verify
Authorization: Bearer <superadmin_token>
```

**Response:**
```json
{
  "id": "domain_xyz",
  "verified": true,
  "verifiedAt": "2025-04-28T12:00:00Z"
}
```

### 4.2 Change Domain Kind

```
PATCH /api/v1/domains/:id/kind
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{ "kind": "EPAPER" }
```

**Kind options:** `NEWS` | `EPAPER` | `MAGAZINE`

### 4.3 Assign Categories to Domain

```
PUT /api/v1/domains/:id/categories
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "categoryIds": ["cat_politics", "cat_sports", "cat_business"]
}
```

---

## 5. Settings

### 5.1 Global Entity Settings

```
GET /api/v1/entity/settings
PUT /api/v1/entity/settings
Authorization: Bearer <superadmin_token>
```

**PUT Payload:**
```json
{
  "siteName": "Kaburlu Media",
  "supportEmail": "support@kaburlu.com",
  "logoUrl": "https://r2.example.com/logo.png",
  "maintenanceMode": false
}
```

### 5.2 Tenant-Level Settings

```
GET  /api/v1/tenants/:tenantId/settings
PUT  /api/v1/tenants/:tenantId/settings
Authorization: Bearer <superadmin_token>
```

**PUT Payload:**
```json
{
  "reporterCommission": 40,
  "autoApproveArticles": false,
  "defaultLanguage": "te",
  "subscriptionEnabled": true
}
```

### 5.3 Domain-Level Settings

```
GET   /api/v1/tenants/:tenantId/domains/:domainId/settings
PUT   /api/v1/tenants/:tenantId/domains/:domainId/settings
Authorization: Bearer <superadmin_token>
```

### 5.4 Auto-bootstrap ePaper Settings for Domain

```
POST /api/v1/tenants/:tenantId/domains/:domainId/settings/epaper/auto
Authorization: Bearer <superadmin_token>
```

**Response:** Creates default ePaper config for that domain.

### 5.5 Reporter Pricing

```
GET   /api/v1/tenants/:tenantId/reporter-pricing
PATCH /api/v1/tenants/:tenantId/reporter-pricing
Authorization: Bearer <superadmin_token>
```

**PATCH Payload:**
```json
{
  "basicPlan": 499,
  "premiumPlan": 999,
  "trialDays": 7
}
```

---

## 6. Journalist Union — Super Admin

> Super Admin sets up the journalist union system. Union Admins handle day-to-day.

### Full Setup Flow (do once per union):

```
Step 1: Seed default post hierarchy
Step 2: Assign union admins
Step 3: Upload logo/stamp/signature
Step 4: Set signatory details
```

---

### 6.1 Seed Default Post Hierarchy

Creates the post definitions (Founder, National President, State President, etc.) for a union.

```
POST /api/v1/journalist/admin/posts/seed-defaults
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "unionName": "Democratic Journalist Federation (Working)"
}
```

**Response:**
```json
{
  "message": "Default posts seeded",
  "count": 12,
  "posts": [
    { "id": "post_1", "title": "Founder", "level": 1, "scope": "NATIONAL" },
    { "id": "post_2", "title": "National President", "level": 2, "scope": "NATIONAL" },
    { "id": "post_3", "title": "State President", "level": 3, "scope": "STATE" },
    { "id": "post_4", "title": "District President", "level": 4, "scope": "DISTRICT" }
  ]
}
```

---

### 6.2 Assign Union Admin

```
POST /api/v1/journalist/admin/assign-union-admin
Authorization: Bearer <superadmin_token>
```

**Payload (national admin — no state restriction):**
```json
{
  "userId": "user_admin123",
  "unionName": "Democratic Journalist Federation (Working)"
}
```

**Payload (state-scoped admin — can only manage Andhra Pradesh members):**
```json
{
  "userId": "user_state_admin456",
  "unionName": "Democratic Journalist Federation (Working)",
  "state": "Andhra Pradesh"
}
```

**Response:**
```json
{
  "message": "Union admin assigned",
  "admin": {
    "id": "union_admin_xyz",
    "userId": "user_admin123",
    "unionName": "Democratic Journalist Federation (Working)",
    "state": null,
    "user": {
      "mobileNumber": "9876543210",
      "profile": { "fullName": "Venkata Rao" }
    }
  }
}
```

---

### 6.3 List Union Admins

```
GET /api/v1/journalist/admin/union-admins
Authorization: Bearer <superadmin_token>
```

**Response:**
```json
[
  {
    "id": "union_admin_xyz",
    "unionName": "Democratic Journalist Federation (Working)",
    "state": null,
    "user": {
      "id": "user_admin123",
      "mobileNumber": "9876543210",
      "profile": { "fullName": "Venkata Rao" }
    }
  },
  {
    "id": "union_admin_abc",
    "unionName": "Democratic Journalist Federation (Working)",
    "state": "Andhra Pradesh",
    "user": {
      "id": "user_state_admin456",
      "mobileNumber": "9000022222",
      "profile": { "fullName": "Suresh Babu" }
    }
  }
]
```

---

### 6.4 Remove Union Admin

```
DELETE /api/v1/journalist/admin/union-admins/:id
Authorization: Bearer <superadmin_token>
```

**Response:**
```json
{ "message": "Union admin removed" }
```

---

### 6.5 Upload Union Assets (logo, stamp, signature)

> Used to set the images that appear on every press card.

```
POST /api/v1/journalist/admin/settings/upload
Authorization: Bearer <superadmin_token>
Content-Type: multipart/form-data
```

**Form fields:**

| field | type | required | description |
|-------|------|----------|-------------|
| `file` | File | ✅ | PNG/JPG — auto-converted to PNG |
| `field` | string | ✅ | `logo` \| `idCardLogo` \| `stamp` \| `forStamp` |
| `unionName` | string | ✅ | Target union slug |

**Example (upload main logo):**
```typescript
const formData = new FormData();
formData.append('file', logoFile);          // File object
formData.append('field', 'logo');
formData.append('unionName', 'Democratic Journalist Federation (Working)');

const res = await fetch(`${API}/api/v1/journalist/admin/settings/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },  // No Content-Type — browser sets multipart
  body: formData,
});
```

**Response:**
```json
{
  "field": "logo",
  "url": "https://pub-xxx.r2.dev/journalist-union/democratic_journalist_federation/assets/logo.png",
  "settings": {
    "unionName": "Democratic Journalist Federation (Working)",
    "logoUrl": "https://...",
    "idCardLogoUrl": null,
    "stampUrl": null
  }
}
```

---

### 6.6 Upload State-Level Signature

> Each state's president has their own signature on state members' press cards.

```
POST /api/v1/journalist/admin/settings/state/upload
Authorization: Bearer <superadmin_token>
Content-Type: multipart/form-data
```

**Form fields:**

| field | description |
|-------|-------------|
| `file` | Signature image |
| `field` | `presidentSignature` \| `stateLogo` |
| `state` | `Andhra Pradesh` |
| `unionName` | Target union |

---

### 6.7 Update Union Settings (signatory name, title, founder signature)

```
PUT /api/v1/journalist/admin/settings
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "unionName": "Democratic Journalist Federation (Working)",
  "displayName": "DJFW",
  "phone": "+91-98765-43210",
  "email": "info@djfw.org",
  "address": "H.No 1-2-3, Hyderabad",
  "registrationNumber": "AP/2020/DJFW/001",
  "signatoryName": "T. Arunkumar",
  "signatoryTitle": "Founder & National President"
}
```

---

## 7. Journalist Union — Admin Flow

> Union Admins do day-to-day operations. Super Admin can also do all of these.

### Complete Member Lifecycle:

```
Member applies → Admin reviews → Admin approves → Admin issues card → Card used → Member requests renewal → Admin renews
```

---

### 7.1 Review Applications

```
GET /api/v1/journalist/admin/applications?approved=false&page=1&limit=20
Authorization: Bearer <admin_token>
```

**Query params:**
- `approved=false` — pending (default)
- `approved=true` — already approved
- `approved=all` — both
- `district=Guntur` — filter by district
- `kycVerified=true|false` — filter by KYC status

**Response:**
```json
{
  "total": 45,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "profile_abc",
      "userId": "user_123",
      "designation": "Reporter",
      "district": "Guntur",
      "state": "Andhra Pradesh",
      "mandal": "Narasaraopet",
      "organization": "TV5 News",
      "unionName": "DJFW",
      "approved": false,
      "kycVerified": false,
      "createdAt": "2025-04-20T08:00:00Z",
      "user": {
        "mobileNumber": "9876500001",
        "profile": { "fullName": "Ramesh Kumar" }
      },
      "card": null
    }
  ]
}
```

---

### 7.2 Approve / Reject Application

```
PATCH /api/v1/journalist/admin/approve/:profileId
Authorization: Bearer <admin_token>
```

**Approve with press ID:**
```json
{
  "approved": true,
  "pressId": "AP-GNT-2025-001"
}
```

**Reject:**
```json
{
  "approved": false
}
```

**Response:**
```json
{
  "message": "Application approved",
  "profile": {
    "id": "profile_abc",
    "approved": true,
    "approvedAt": "2025-04-28T10:30:00Z",
    "pressId": "AP-GNT-2025-001"
  }
}
```

---

### 7.3 Issue Press Card

After approval, generate the physical press card (PDF uploaded to R2).

```
POST /api/v1/journalist/admin/generate-card
Authorization: Bearer <admin_token>
```

**Payload:**
```json
{
  "profileId": "profile_abc"
}
```

**Response:**
```json
{
  "message": "Press card generated",
  "card": {
    "id": "card_xyz",
    "profileId": "profile_abc",
    "cardNumber": "JU-1745844000000",
    "expiryDate": "2026-04-28T00:00:00Z",
    "status": "ACTIVE",
    "pdfUrl": null,
    "renewalCount": 0
  }
}
```

> ℹ️ PDF is generated in the background (R2 upload). `pdfUrl` will be populated after ~5-10 seconds. Call `GET /journalist/admin/applications?approved=true` to poll for the URL, or use `POST /admin/cards/:profileId/generate-pdf` to trigger again.

---

### 7.4 Re-generate Press Card PDF

```
POST /api/v1/journalist/admin/cards/:profileId/generate-pdf
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "message": "Press card PDF generated",
  "pdfUrl": "https://pub.r2.dev/journalist-union/djfw/cards/profile_abc.pdf",
  "cardNumber": "JU-1745844000000"
}
```

---

### 7.5 Cards Due for Renewal

```
GET /api/v1/journalist/admin/cards/renewal-due?expiringDays=30&pendingOnly=false
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "total": 8,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "cardNumber": "JU-1745844000000",
      "profileId": "profile_abc",
      "memberName": "Ramesh Kumar",
      "designation": "Reporter",
      "district": "Guntur",
      "expiryDate": "2026-05-10T00:00:00Z",
      "daysUntilExpiry": 12,
      "pendingRenewal": true,
      "pendingRenewalAt": "2026-04-25T14:00:00Z",
      "renewalCount": 0,
      "status": "ACTIVE"
    }
  ]
}
```

---

### 7.6 Approve Renewal

```
PATCH /api/v1/journalist/admin/cards/:profileId/renew
Authorization: Bearer <admin_token>
```

**No body needed.**

**Response:**
```json
{
  "message": "Card renewed. New expiry: 10/05/2027",
  "card": {
    "cardNumber": "JU-1745844000000",
    "expiryDate": "2027-05-10T00:00:00Z",
    "renewalCount": 1,
    "renewedAt": "2026-04-28T10:00:00Z",
    "pendingRenewal": false,
    "status": "ACTIVE"
  }
}
```

---

### 7.7 KYC Verification

```
PATCH /api/v1/journalist/admin/kyc/verify/:profileId
Authorization: Bearer <admin_token>
```

**Payload:**
```json
{
  "kycVerified": true,
  "kycNote": "Aadhaar and press ID verified in-person"
}
```

---

### 7.8 Complaints

**List complaints:**
```
GET /api/v1/journalist/admin/complaints?status=OPEN&page=1&limit=20
Authorization: Bearer <admin_token>
```

**Update complaint:**
```
PATCH /api/v1/journalist/admin/complaints/:id
Authorization: Bearer <admin_token>
```
```json
{
  "status": "IN_PROGRESS",
  "adminNote": "Raised with district SP office. Awaiting response."
}
```

**Status values:** `OPEN` | `IN_PROGRESS` | `CLOSED`

---

### 7.9 Appoint Committee Post

```
POST /api/v1/journalist/admin/posts/appoint
Authorization: Bearer <admin_token>
```

**Payload:**
```json
{
  "profileId": "profile_abc",
  "postDefinitionId": "post_3",
  "state": "Andhra Pradesh",
  "district": "Guntur",
  "startDate": "2025-01-01",
  "endDate": "2027-12-31"
}
```

**Response:**
```json
{
  "message": "Post appointed",
  "holding": {
    "id": "holding_xyz",
    "profileId": "profile_abc",
    "postTitle": "State President",
    "state": "Andhra Pradesh",
    "district": "Guntur"
  }
}
```

---

### 7.10 Post Union Announcement

```
POST /api/v1/journalist/admin/updates
Authorization: Bearer <admin_token>
```

**Payload:**
```json
{
  "title": "Annual Convention — Hyderabad",
  "content": "All members are invited to the annual convention on May 15th at LB Stadium, Hyderabad.",
  "unionName": "Democratic Journalist Federation (Working)",
  "imageUrl": "https://pub.r2.dev/announcements/convention.png"
}
```

---

## 8. AI Usage & Billing

### 8.1 View AI Usage Logs

```
GET /api/v1/admin/ai/usage?tenantId=tenant_abc&from=2025-04-01&to=2025-04-28
Authorization: Bearer <superadmin_token>
```

**Response:**
```json
{
  "logs": [
    {
      "id": "log_123",
      "tenantId": "tenant_abc",
      "model": "gemini-1.5-flash",
      "promptTokens": 450,
      "completionTokens": 200,
      "totalTokens": 650,
      "costUsd": 0.00065,
      "createdAt": "2025-04-27T10:00:00Z"
    }
  ]
}
```

### 8.2 Usage Summary

```
GET /api/v1/admin/ai/usage/summary?from=2025-04-01&to=2025-04-28
Authorization: Bearer <superadmin_token>
```

**Response:**
```json
{
  "totalRequests": 1250,
  "totalTokens": 2500000,
  "totalCostUsd": 2.50,
  "byTenant": [
    { "tenantId": "tenant_abc", "name": "TV9", "requests": 800, "costUsd": 1.60 }
  ]
}
```

### 8.3 Enable/Disable AI Billing for Tenant

```
PATCH /api/v1/admin/tenants/:tenantId/ai-billing
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "enabled": true,
  "monthlyBudgetUsd": 50,
  "alertThresholdPercent": 80
}
```

---

## 9. Razorpay Config

### 9.1 Set Global Razorpay Keys

```
PUT /api/v1/admin/razorpay-config/global
Authorization: Bearer <superadmin_token>
```

**Payload:**
```json
{
  "keyId": "rzp_live_xxxxxxxxxxxx",
  "keySecret": "xxxxxxxxxxxxxxxxxxxxxxxx"
}
```

### 9.2 Get Global Config

```
GET /api/v1/admin/razorpay-config/global
Authorization: Bearer <superadmin_token>
```

---

## 10. Next.js Integration Pattern

### Folder Structure

```
app/
  (admin)/
    layout.tsx          ← Auth guard + sidebar
    dashboard/page.tsx
    tenants/
      page.tsx          ← List tenants
      [id]/page.tsx     ← Single tenant detail
      new/page.tsx      ← Create tenant form
    journalist-union/
      page.tsx          ← Union overview
      admins/page.tsx   ← Assign/list union admins
      applications/page.tsx
      cards/page.tsx
      renewal/page.tsx

lib/
  api.ts               ← Central fetch wrapper
  auth.ts              ← Token management
```

---

### Central API Wrapper

```typescript
// lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL + '/api/v1';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get:    <T>(path: string) => apiFetch<T>(path),
  post:   <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PUT',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },
};
```

---

### Example: Applications Page

```typescript
// app/(admin)/journalist-union/applications/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Application {
  id: string;
  designation: string;
  district: string;
  state: string;
  organization: string;
  approved: boolean;
  user: { mobileNumber: string; profile: { fullName: string } };
  card: null | { cardNumber: string; status: string };
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');

  const loadApps = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ data: Application[] }>(
        `/journalist/admin/applications?approved=${tab === 'approved' ? 'true' : 'false'}&limit=50`
      );
      setApps(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadApps(); }, [tab]);

  const handleApprove = async (profileId: string, pressId: string) => {
    await api.patch(`/journalist/admin/approve/${profileId}`, {
      approved: true,
      pressId,
    });
    loadApps(); // refresh
  };

  const handleIssueCard = async (profileId: string) => {
    await api.post('/journalist/admin/generate-card', { profileId });
    alert('Card generation started! PDF will be ready in ~10 seconds.');
  };

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('pending')}
          className={tab === 'pending' ? 'bg-blue-600 text-white px-4 py-2 rounded' : 'px-4 py-2 rounded border'}>
          Pending
        </button>
        <button onClick={() => setTab('approved')}
          className={tab === 'approved' ? 'bg-blue-600 text-white px-4 py-2 rounded' : 'px-4 py-2 rounded border'}>
          Approved
        </button>
      </div>

      {loading ? <div>Loading...</div> : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Name</th>
              <th>Mobile</th>
              <th>District</th>
              <th>Organization</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {apps.map(app => (
              <tr key={app.id} className="border-b">
                <td className="p-2">{app.user.profile?.fullName ?? '—'}</td>
                <td>{app.user.mobileNumber}</td>
                <td>{app.district}, {app.state}</td>
                <td>{app.organization}</td>
                <td className="flex gap-2 p-2">
                  {!app.approved && (
                    <button
                      onClick={() => {
                        const pressId = prompt('Press ID (e.g. AP-GNT-2025-001):') ?? '';
                        handleApprove(app.id, pressId);
                      }}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Approve
                    </button>
                  )}
                  {app.approved && !app.card && (
                    <button
                      onClick={() => handleIssueCard(app.id)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                    >
                      Issue Card
                    </button>
                  )}
                  {app.card && (
                    <span className="text-green-700 text-sm font-semibold">
                      Card: {app.card.cardNumber}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

### Example: Renewal Dashboard Widget

```typescript
// components/RenewalDueWidget.tsx
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function RenewalDueWidget() {
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    api.get<{ data: any[] }>('/journalist/admin/cards/renewal-due?expiringDays=30&limit=5')
      .then(d => setCards(d.data));
  }, []);

  const renew = async (profileId: string) => {
    await api.patch(`/journalist/admin/cards/${profileId}/renew`, {});
    setCards(prev => prev.filter(c => c.profileId !== profileId));
  };

  if (!cards.length) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
      <h3 className="font-bold text-yellow-800 mb-3">
        ⚠️ {cards.length} Cards Due for Renewal
      </h3>
      {cards.map(c => (
        <div key={c.cardId} className="flex justify-between items-center py-2 border-b border-yellow-200">
          <div>
            <div className="font-medium">{c.memberName}</div>
            <div className="text-sm text-gray-600">
              {c.cardNumber} · Expires in {c.daysUntilExpiry} days
              {c.pendingRenewal && <span className="ml-2 text-blue-600 font-semibold">● Requested</span>}
            </div>
          </div>
          <button onClick={() => renew(c.profileId)}
            className="bg-green-600 text-white px-3 py-1 rounded text-sm">
            Renew
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

### Example: Assign Union Admin Form

```typescript
// app/(admin)/journalist-union/admins/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function UnionAdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: '', unionName: '', state: '' });

  useEffect(() => {
    api.get<any[]>('/journalist/admin/union-admins').then(setAdmins);
  }, []);

  const assign = async () => {
    await api.post('/journalist/admin/assign-union-admin', {
      userId: form.userId,
      unionName: form.unionName,
      state: form.state || undefined,
    });
    setForm({ userId: '', unionName: '', state: '' });
    const updated = await api.get<any[]>('/journalist/admin/union-admins');
    setAdmins(updated);
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this admin?')) return;
    await api.delete(`/journalist/admin/union-admins/${id}`);
    setAdmins(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Union Admins</h2>

      {/* Assign form */}
      <div className="bg-gray-50 p-4 rounded mb-6 flex flex-col gap-3 max-w-md">
        <h3 className="font-semibold">Assign New Union Admin</h3>
        <input placeholder="User ID" value={form.userId}
          onChange={e => setForm(p => ({ ...p, userId: e.target.value }))}
          className="border p-2 rounded" />
        <input placeholder="Union Name" value={form.unionName}
          onChange={e => setForm(p => ({ ...p, unionName: e.target.value }))}
          className="border p-2 rounded" />
        <input placeholder="State (leave blank for national)" value={form.state}
          onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
          className="border p-2 rounded" />
        <button onClick={assign} className="bg-blue-600 text-white py-2 rounded">
          Assign
        </button>
      </div>

      {/* List */}
      {admins.map(a => (
        <div key={a.id} className="flex justify-between items-center p-3 border rounded mb-2">
          <div>
            <div className="font-medium">{a.user?.profile?.fullName}</div>
            <div className="text-sm text-gray-600">
              {a.unionName} {a.state ? `· ${a.state}` : '· National'}
            </div>
          </div>
          <button onClick={() => remove(a.id)}
            className="text-red-600 border border-red-300 px-3 py-1 rounded text-sm">
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## Quick Reference — All Super Admin APIs

| # | Method | URL | Description |
|---|--------|-----|-------------|
| 1 | POST | `/auth/login` | Get JWT token |
| 2 | GET | `/api/v1/tenants` | List all tenants |
| 3 | POST | `/api/v1/tenants` | Create tenant |
| 4 | PATCH | `/api/v1/tenants/:id` | Update tenant |
| 5 | POST | `/api/v1/tenants/:id/domains` | Add domain to tenant |
| 6 | PATCH | `/api/v1/tenants/:id/feature-flags` | Toggle features |
| 7 | POST | `/api/v1/tenant-admins` | Create tenant admin |
| 8 | GET | `/api/v1/tenant-admins` | List tenant admins |
| 9 | PUT | `/api/v1/tenant-admins/:userId` | Update tenant admin |
| 10 | DELETE | `/api/v1/tenant-admins/:userId` | Remove tenant admin |
| 11 | POST | `/api/v1/domains/:id/verify` | Verify domain |
| 12 | PATCH | `/api/v1/domains/:id/kind` | Change domain kind |
| 13 | GET/PUT | `/api/v1/entity/settings` | Global entity settings |
| 14 | GET/PUT | `/api/v1/tenants/:id/settings` | Tenant settings |
| 15 | GET/PUT | `/api/v1/tenants/:id/domains/:did/settings` | Domain settings |
| 16 | GET/PATCH | `/api/v1/tenants/:id/reporter-pricing` | Reporter pricing |
| 17 | POST | `/api/v1/journalist/admin/posts/seed-defaults` | Seed union post hierarchy |
| 18 | POST | `/api/v1/journalist/admin/assign-union-admin` | Assign union admin |
| 19 | GET | `/api/v1/journalist/admin/union-admins` | List union admins |
| 20 | DELETE | `/api/v1/journalist/admin/union-admins/:id` | Remove union admin |
| 21 | POST | `/api/v1/journalist/admin/settings/upload` | Upload logo/stamp |
| 22 | POST | `/api/v1/journalist/admin/settings/state/upload` | Upload state signature |
| 23 | PUT | `/api/v1/journalist/admin/settings` | Update union settings |
| 24 | GET | `/api/v1/journalist/admin/applications` | List member applications |
| 25 | PATCH | `/api/v1/journalist/admin/approve/:id` | Approve/reject application |
| 26 | POST | `/api/v1/journalist/admin/generate-card` | Issue press card |
| 27 | POST | `/api/v1/journalist/admin/cards/:id/generate-pdf` | Regen press card PDF |
| 28 | GET | `/api/v1/journalist/admin/cards/renewal-due` | Renewal due list |
| 29 | PATCH | `/api/v1/journalist/admin/cards/:id/renew` | Approve renewal |
| 30 | GET | `/api/v1/journalist/admin/complaints` | List complaints |
| 31 | PATCH | `/api/v1/journalist/admin/complaints/:id` | Update complaint |
| 32 | POST | `/api/v1/journalist/admin/updates` | Post announcement |
| 33 | POST | `/api/v1/journalist/admin/posts/appoint` | Appoint committee post |
| 34 | GET | `/api/v1/admin/ai/usage/summary` | AI usage summary |
| 35 | PATCH | `/api/v1/admin/tenants/:id/ai-billing` | AI billing config |
| 36 | GET/PUT | `/api/v1/admin/razorpay-config/global` | Razorpay config |
