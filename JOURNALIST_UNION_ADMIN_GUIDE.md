# Journalist Union — Complete API Guide for Next.js Admin Panel

> Base URL: `https://api.kaburlu.com` (or your production URL)  
> All admin/member routes: `POST/GET/PATCH/PUT/DELETE /api/v1/journalist/...`  
> Auth: `Authorization: Bearer <token>` (JWT from login API)

---

## API Client Setup (lib/unionApi.ts)

```typescript
// lib/unionApi.ts
const BASE = process.env.NEXT_PUBLIC_API_URL; // e.g. https://api.kaburlu.com

const token = () =>
  typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

const headers = (isMultipart = false) => ({
  ...(isMultipart ? {} : { "Content-Type": "application/json" }),
  Authorization: `Bearer ${token()}`,
});

export const api = {
  get: async (path: string, params?: Record<string, string | number | boolean>) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    const res = await fetch(`${BASE}${path}${qs}`, { headers: headers() });
    return res.json();
  },
  post: async (path: string, body?: object) => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    return res.json();
  },
  put: async (path: string, body: object) => {
    const res = await fetch(`${BASE}${path}`, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    });
    return res.json();
  },
  patch: async (path: string, body: object) => {
    const res = await fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(body),
    });
    return res.json();
  },
  del: async (path: string) => {
    const res = await fetch(`${BASE}${path}`, {
      method: "DELETE",
      headers: headers(),
    });
    return res.json();
  },
  upload: async (path: string, formData: FormData) => {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` }, // no Content-Type for multipart
      body: formData,
    });
    return res.json();
  },
};
```

---

## Role Hierarchy

| Role | Access |
|------|--------|
| `SUPER_ADMIN` | All journalist union APIs — no union restriction |
| `JournalistUnionAdmin` (DB record) | Same admin endpoints but scoped to their `unionName` |
| Approved journalist (JWT) | Member endpoints only |
| Public | No auth required |

> **SuperAdmin does NOT need to be assigned via `/admin/assign-union-admin`** — they pass all `requireJournalistUnionAdmin` checks automatically.  
> For union-admin-scoped endpoints, **SuperAdmin must pass `unionName`** as a query param or request body field.

---

## Step 1 — SuperAdmin: Assign a Union Admin

```
POST /api/v1/journalist/admin/assign-union-admin
```

**Payload**
```json
{
  "userId": "clxxx001",
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana"
}
```

**Response 201**
```json
{
  "message": "Union admin assigned successfully",
  "note": "User can now access journalist union admin endpoints for this union.",
  "unionAdmin": {
    "id": "ua_clxxx001",
    "userId": "clxxx001",
    "unionName": "Telangana Working Journalists Federation",
    "state": "Telangana",
    "createdAt": "2026-01-01T10:00:00Z"
  }
}
```

**Next.js hook**
```typescript
// hooks/useSuperAdminJournalist.ts
export function useAssignUnionAdmin() {
  const assign = async (userId: string, unionName: string, state?: string) => {
    return api.post("/api/v1/journalist/admin/assign-union-admin", {
      userId,
      unionName,
      state,
    });
  };
  return { assign };
}
```

---

## Step 2 — SuperAdmin: List & Remove Union Admins

```
GET  /api/v1/journalist/admin/union-admins
DELETE /api/v1/journalist/admin/union-admins/:id
```

**GET Response 200**
```json
[
  {
    "id": "ua_clxxx001",
    "userId": "clxxx001",
    "unionName": "Telangana Working Journalists Federation",
    "state": "Telangana",
    "user": {
      "mobileNumber": "9876543210",
      "email": "admin@twjf.org",
      "role": { "name": "TENANT_ADMIN" },
      "profile": { "fullName": "Ravi Kumar" }
    }
  }
]
```

**DELETE Response 200**
```json
{ "message": "Union admin removed" }
```

**Next.js page**
```typescript
// pages/super-admin/union-admins.tsx
export default function UnionAdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/v1/journalist/admin/union-admins").then(setAdmins);
  }, []);

  const remove = async (id: string) => {
    await api.del(`/api/v1/journalist/admin/union-admins/${id}`);
    setAdmins((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div>
      {admins.map((a) => (
        <div key={a.id}>
          {a.user.profile?.fullName} — {a.unionName} ({a.state})
          <button onClick={() => remove(a.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
```

---

## Step 3 — SuperAdmin: Seed Default Post Definitions

Must be done **once per union** before appointing committee members.

```
POST /api/v1/journalist/admin/posts/seed-defaults
```

**Payload**
```json
{
  "unionName": "Telangana Working Journalists Federation"
}
```

**Response 201**
```json
{
  "message": "Default posts seeded",
  "created": 28,
  "total": 28
}
```

> **If called again:** `{ "message": "All default posts already exist for this union", "created": 0 }`  
> Safe to re-run — idempotent.

Posts seeded cover: **STATE**, **DISTRICT**, **MANDAL**, **CITY**, **SPECIAL_WING** levels in both English and Telugu (`nativeTitle`).

---

## Step 4 — Admin: Union Settings (Text)

### 4a. Get Settings (Admin)

```
GET /api/v1/journalist/admin/settings?unionName=<union>
```

> **Scoped admins**: `unionName` param is not needed — auto-resolved from their scope.  
> **SuperAdmin**: must pass `?unionName=Telangana Working Journalists Federation`

**Response 200**
```json
{
  "id": "sett_001",
  "unionName": "Telangana Working Journalists Federation",
  "displayName": "TWJF — Telangana Working Journalists Federation",
  "registrationNumber": "REG/TG/2005/001",
  "address": "Press Club Road, Hyderabad",
  "states": ["Telangana"],
  "primaryState": "Telangana",
  "foundedYear": 2005,
  "email": "contact@twjf.org",
  "phone": "04023001234",
  "websiteUrl": "https://twjf.org",
  "logoUrl": "https://r2.kaburlu.com/journalist-union/twjf/assets/logo.png",
  "idCardLogoUrl": "https://r2.kaburlu.com/journalist-union/twjf/assets/idCardLogo.png",
  "stampUrl": "https://r2.kaburlu.com/journalist-union/twjf/assets/stamp.png",
  "forStampUrl": null,
  "stateConfigs": [
    {
      "id": "sc_001",
      "unionName": "...",
      "state": "Telangana",
      "address": "Hyderabad",
      "email": "telangana@twjf.org",
      "phone": null,
      "presidentSignatureUrl": "https://r2.kaburlu.com/journalist-union/twjf/states/telangana/presidentSignature.png",
      "stateLogo": null
    }
  ]
}
```

### 4b. Update Settings (Text fields)

```
PUT /api/v1/journalist/admin/settings
```

**Payload** (pass only fields you want to update)
```json
{
  "unionName": "Telangana Working Journalists Federation",
  "displayName": "TWJF — Telangana Working Journalists Federation",
  "registrationNumber": "REG/TG/2005/001",
  "address": "Press Club Road, Hyderabad - 500001",
  "states": ["Telangana"],
  "primaryState": "Telangana",
  "foundedYear": 2005,
  "email": "contact@twjf.org",
  "phone": "04023001234",
  "websiteUrl": "https://twjf.org"
}
```

**Response 200**
```json
{
  "message": "Settings saved",
  "settings": { /* full settings object */ }
}
```

### 4c. Update State-specific Settings (Text)

```
PUT /api/v1/journalist/admin/settings/state
```

**Payload**
```json
{
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana",
  "address": "Press Club Road, Hyderabad",
  "email": "telangana@twjf.org",
  "phone": "9876000001"
}
```

**Response 200**
```json
{
  "message": "State settings saved",
  "stateConfig": {
    "id": "sc_001",
    "unionName": "...",
    "state": "Telangana",
    "address": "Press Club Road, Hyderabad",
    "email": "telangana@twjf.org",
    "phone": "9876000001",
    "presidentSignatureUrl": null,
    "stateLogo": null
  }
}
```

---

## Step 5 — Admin: Upload Union Assets (Images)

### 5a. Upload Union Logo / Stamp

```
POST /api/v1/journalist/admin/settings/upload
Content-Type: multipart/form-data
```

| Form field | Type | Allowed values |
|------------|------|----------------|
| `file` | Binary | Any image (converted to PNG) |
| `field` | String | `logo` \| `idCardLogo` \| `stamp` \| `forStamp` |
| `unionName` | String | **Required for SuperAdmin** |

**Response 200**
```json
{
  "field": "logo",
  "url": "https://r2.kaburlu.com/journalist-union/telangana_working.../assets/logo.png",
  "settings": { /* full settings */ }
}
```

**Next.js upload component**
```typescript
// components/UnionAssetUpload.tsx
export function UnionAssetUpload({
  unionName,
  field,
  label,
}: {
  unionName: string;
  field: "logo" | "idCardLogo" | "stamp" | "forStamp";
  label: string;
}) {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("field", field);
    fd.append("unionName", unionName); // needed only for SuperAdmin
    
    const result = await api.upload("/api/v1/journalist/admin/settings/upload", fd);
    console.log("Uploaded:", result.url);
  };

  return (
    <label>
      {label}
      <input type="file" accept="image/*" onChange={handleUpload} />
    </label>
  );
}
```

### 5b. Upload President Signature (Per State)

```
POST /api/v1/journalist/admin/settings/state/upload
Content-Type: multipart/form-data
```

| Form field | Type | Allowed values |
|------------|------|----------------|
| `file` | Binary | Image (converted to PNG) |
| `field` | String | `presidentSignature` \| `stateLogo` |
| `state` | String | e.g. `Andhra Pradesh` |
| `unionName` | String | **Required for SuperAdmin** |

**Response 200**
```json
{
  "field": "presidentSignature",
  "state": "Telangana",
  "url": "https://r2.kaburlu.com/journalist-union/twjf/states/telangana/presidentSignature.png",
  "stateConfig": { /* full state settings */ }
}
```

---

## Step 6 — Members Apply (Public — No Auth)

```
POST /api/v1/journalist/public/apply
```

**Payload**
```json
{
  "mobileNumber": "9876543210",
  "mpin": "1234",
  "designation": "Senior Reporter",
  "district": "Hyderabad",
  "organization": "Sakshi TV",
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana",
  "mandal": "Secunderabad"
}
```

> `mpin` required only for new users. `state`, `mandal`, `unionName` are optional.

**Response 201**
```json
{
  "message": "New account created and application submitted. Login with your mobile number and MPIN.",
  "isNewAccount": true,
  "reporterLinked": false,
  "reporterTenant": null,
  "profile": {
    "id": "jp_clxxx001",
    "userId": "clxxx002",
    "designation": "Senior Reporter",
    "district": "Hyderabad",
    "organization": "Sakshi TV",
    "unionName": "Telangana Working Journalists Federation",
    "state": "Telangana",
    "mandal": "Secunderabad",
    "approved": false,
    "pressId": null,
    "kycVerified": false,
    "createdAt": "2026-01-01T10:00:00Z"
  }
}
```

---

## Step 7 — Admin: Applications Dashboard

### 7a. List Applications

```
GET /api/v1/journalist/admin/applications?approved=false&page=1&limit=20
```

| Query Param | Values | Default |
|-------------|--------|---------|
| `approved` | `true` \| `false` \| `all` | `false` (pending) |
| `district` | string filter | — |
| `kycVerified` | `true` \| `false` | — |
| `page` | integer | 1 |
| `limit` | 1–100 | 20 |

**Response 200**
```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "jp_001",
      "designation": "Reporter",
      "district": "Hyderabad",
      "organization": "Sakshi TV",
      "unionName": "Telangana Working Journalists Federation",
      "state": "Telangana",
      "mandal": null,
      "approved": false,
      "pressId": null,
      "kycVerified": false,
      "photoUrl": null,
      "aadhaarUrl": null,
      "createdAt": "2026-01-01T10:00:00Z",
      "user": {
        "mobileNumber": "9876543210",
        "email": null,
        "profile": { "fullName": "Ravi Kumar" }
      },
      "card": null
    }
  ]
}
```

**Next.js applications page**
```typescript
// pages/admin/journalist/applications.tsx
import { useState, useEffect } from "react";
import { api } from "@/lib/unionApi";

export default function ApplicationsPage() {
  const [data, setData] = useState<{ total: number; data: any[] }>({ total: 0, data: [] });
  const [filter, setFilter] = useState<"false" | "true" | "all">("false");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api
      .get("/api/v1/journalist/admin/applications", { approved: filter, page, limit: 20 })
      .then(setData);
  }, [filter, page]);

  return (
    <div>
      <div>
        <button onClick={() => setFilter("false")}>Pending ({filter === "false" ? data.total : ""})</button>
        <button onClick={() => setFilter("true")}>Approved</button>
        <button onClick={() => setFilter("all")}>All</button>
      </div>
      {data.data.map((app) => (
        <ApplicationCard key={app.id} application={app} onApprove={() => {}} />
      ))}
    </div>
  );
}
```

### 7b. Approve / Reject Application

```
PATCH /api/v1/journalist/admin/approve/:id
```

**Payload (Approve)**
```json
{
  "approved": true,
  "pressId": "TWJF-2026-001"
}
```

**Payload (Reject)**
```json
{
  "approved": false
}
```

**Response 200**
```json
{
  "message": "Application approved",
  "profile": {
    "id": "jp_001",
    "approved": true,
    "approvedAt": "2026-01-15T10:00:00Z",
    "pressId": "TWJF-2026-001"
  }
}
```

**Error 409** (pressId duplicate)
```json
{ "error": "pressId already in use" }
```

---

## Step 8 — Admin: Generate Press Card

After approval, generate the digital press card:

```
POST /api/v1/journalist/admin/generate-card
```

**Payload**
```json
{
  "profileId": "jp_001",
  "expiryDate": "2027-01-15"
}
```

> `expiryDate` is optional — defaults to **1 year** from today.  
> PDF is generated and uploaded to R2 **in the background** (non-blocking).

**Response 201**
```json
{
  "message": "Press card generated",
  "card": {
    "id": "jc_001",
    "profileId": "jp_001",
    "cardNumber": "JU-1705312800000",
    "status": "ACTIVE",
    "expiryDate": "2027-01-15T00:00:00Z",
    "pdfUrl": null,
    "renewalCount": 0,
    "pendingRenewal": false,
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

**Next.js approve + generate flow**
```typescript
// components/ApproveAndGenerateCard.tsx
export function ApproveAndGenerateCard({ profileId }: { profileId: string }) {
  const [pressId, setPressId] = useState("");

  const handleApproveAndGenerate = async () => {
    // Step 1: Approve
    await api.patch(`/api/v1/journalist/admin/approve/${profileId}`, {
      approved: true,
      pressId,
    });
    // Step 2: Generate card (1 year validity auto)
    const result = await api.post("/api/v1/journalist/admin/generate-card", {
      profileId,
    });
    alert(`Card generated: ${result.card?.cardNumber}`);
  };

  return (
    <div>
      <input
        placeholder="Press ID (e.g. TWJF-2026-001)"
        value={pressId}
        onChange={(e) => setPressId(e.target.value)}
      />
      <button onClick={handleApproveAndGenerate}>Approve & Generate Card</button>
    </div>
  );
}
```

---

## Step 9 — Admin: Re-generate Card PDF

Use when: member uploads photo, branding changes, or PDF URL is missing.

```
POST /api/v1/journalist/admin/cards/:profileId/generate-pdf
```

**Response 200**
```json
{
  "message": "Press card PDF generated",
  "pdfUrl": "https://r2.kaburlu.com/journalist-union/press-cards/jp_001.pdf",
  "cardNumber": "JU-1705312800000"
}
```

---

## Step 10 — Admin: Update Card Details

```
PATCH /api/v1/journalist/admin/cards/:profileId
```

**Payload** (any combination)
```json
{
  "expiryDate": "2028-12-31",
  "qrCode": "https://your-verify-url.com/JU-1705312800000",
  "pdfUrl": "https://r2.kaburlu.com/.../press_card.pdf"
}
```

**Response 200**
```json
{
  "message": "Card updated",
  "card": { /* updated card */ }
}
```

---

## Step 11 — Admin: Renewal Dashboard

### 11a. List Cards Due for Renewal

```
GET /api/v1/journalist/admin/cards/renewal-due?expiringDays=30&pendingOnly=false&page=1&limit=20
```

| Param | Default | Notes |
|-------|---------|-------|
| `expiringDays` | 30 | Show cards expiring within N days |
| `pendingOnly` | false | If `true`, only show member-requested renewals |

**Response 200**
```json
{
  "total": 5,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "cardId": "jc_001",
      "cardNumber": "JU-1705312800000",
      "profileId": "jp_001",
      "pressId": "TWJF-2026-001",
      "memberName": "Ravi Kumar",
      "designation": "Reporter",
      "district": "Hyderabad",
      "state": "Telangana",
      "unionName": "Telangana Working Journalists Federation",
      "expiryDate": "2027-01-15T00:00:00Z",
      "daysUntilExpiry": 12,
      "pendingRenewal": true,
      "pendingRenewalAt": "2026-12-30T08:00:00Z",
      "renewalCount": 0,
      "status": "ACTIVE"
    }
  ]
}
```

### 11b. Approve Renewal (Extend 1 Year)

```
PATCH /api/v1/journalist/admin/cards/:profileId/renew
```

No request body needed.

**Response 200**
```json
{
  "message": "Card renewed. New expiry: 15/01/2028",
  "card": {
    "expiryDate": "2028-01-15T00:00:00Z",
    "renewalCount": 1,
    "pendingRenewal": false,
    "status": "ACTIVE"
  }
}
```

> PDF is regenerated and uploaded to R2 in the background.

**Next.js renewal dashboard**
```typescript
// pages/admin/journalist/renewals.tsx
export default function RenewalsPage() {
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    api
      .get("/api/v1/journalist/admin/cards/renewal-due", { expiringDays: 30, pendingOnly: false })
      .then((r) => setCards(r.data));
  }, []);

  const renew = async (profileId: string) => {
    const result = await api.patch(
      `/api/v1/journalist/admin/cards/${profileId}/renew`,
      {}
    );
    alert(result.message);
    setCards((prev) => prev.filter((c) => c.profileId !== profileId));
  };

  return (
    <div>
      <h2>Renewal Due ({cards.length})</h2>
      {cards.map((c) => (
        <div key={c.cardId}>
          <strong>{c.memberName}</strong> — {c.cardNumber} — Expires in {c.daysUntilExpiry} days
          {c.pendingRenewal && <span style={{ color: "red" }}> [RENEWAL REQUESTED]</span>}
          <button onClick={() => renew(c.profileId)}>Renew +1 Year</button>
        </div>
      ))}
    </div>
  );
}
```

---

## Step 12 — Admin: KYC Verification

### 12a. Member Uploads KYC (Member API)

```
POST /api/v1/journalist/kyc/upload
Content-Type: multipart/form-data

field: "photo" | "aadhaar" | "aadhaarBack"
file: <image>
```

### 12b. Admin Verifies KYC

```
PATCH /api/v1/journalist/admin/kyc/verify/:profileId
```

**Payload**
```json
{
  "action": "verify",
  "note": "Aadhaar matches name. Photo verified."
}
```

**Reject:**
```json
{
  "action": "reject",
  "note": "Photo is blurry. Please re-upload."
}
```

**Response 200**
```json
{
  "message": "KYC verified",
  "profile": {
    "id": "jp_001",
    "kycVerified": true,
    "kycVerifiedAt": "2026-01-15T10:00:00Z",
    "kycNote": "Aadhaar matches name. Photo verified.",
    "photoUrl": "https://r2.kaburlu.com/journalist-union/kyc/jp_001/photo.webp",
    "aadhaarUrl": "https://r2.kaburlu.com/journalist-union/kyc/jp_001/aadhaar.png"
  }
}
```

**Next.js KYC review**
```typescript
// components/KycReview.tsx
export function KycReview({ profile }: { profile: any }) {
  const [note, setNote] = useState("");

  const verify = async (action: "verify" | "reject") => {
    await api.patch(`/api/v1/journalist/admin/kyc/verify/${profile.id}`, {
      action,
      note,
    });
  };

  return (
    <div>
      {profile.photoUrl && <img src={profile.photoUrl} alt="Photo" width={100} />}
      {profile.aadhaarUrl && <img src={profile.aadhaarUrl} alt="Aadhaar" width={200} />}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Admin note" />
      <button onClick={() => verify("verify")}>✓ Verify KYC</button>
      <button onClick={() => verify("reject")}>✗ Reject KYC</button>
    </div>
  );
}
```

---

## Step 13 — Admin: Complaints Management

### 13a. List Complaints

```
GET /api/v1/journalist/admin/complaints?status=OPEN&page=1&limit=20
```

| Status values | `OPEN` \| `IN_PROGRESS` \| `CLOSED` |

**Response 200**
```json
{
  "total": 3,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "comp_001",
      "userId": "clxxx002",
      "title": "Police Harassment",
      "description": "Police stopped our reporting at the protest venue.",
      "location": "Hyderabad",
      "status": "OPEN",
      "adminNote": null,
      "createdAt": "2026-01-10T10:00:00Z",
      "user": {
        "mobileNumber": "9876543210",
        "profile": { "fullName": "Ravi Kumar" }
      }
    }
  ]
}
```

### 13b. Update Complaint Status

```
PATCH /api/v1/journalist/admin/complaints/:id
```

**Payload**
```json
{
  "status": "IN_PROGRESS",
  "adminNote": "Forwarded to Press Council of India on 15-Jan-2026"
}
```

**Response 200**
```json
{
  "message": "Complaint updated",
  "complaint": {
    "id": "comp_001",
    "status": "IN_PROGRESS",
    "adminNote": "Forwarded to Press Council of India on 15-Jan-2026"
  }
}
```

---

## Step 14 — Admin: Union Announcements

### 14a. Post Announcement

```
POST /api/v1/journalist/admin/updates
```

**Payload**
```json
{
  "title": "Annual General Meeting - 2026",
  "content": "Dear members, our AGM is scheduled for 25th January 2026 at Press Club Hyderabad.",
  "unionName": "Telangana Working Journalists Federation",
  "imageUrl": "https://r2.kaburlu.com/..."
}
```

> `unionName` is optional for scoped admins (auto-resolved). Pass for SuperAdmin.  
> `imageUrl` is optional.

**Response 201**
```json
{
  "message": "Update posted",
  "update": {
    "id": "upd_001",
    "title": "Annual General Meeting - 2026",
    "content": "Dear members...",
    "unionName": "Telangana Working Journalists Federation",
    "imageUrl": null,
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

### 14b. Delete Announcement

```
DELETE /api/v1/journalist/admin/updates/:id
```

**Response 200**
```json
{ "message": "Deleted" }
```

---

## Step 15 — Admin: Insurance Management

### 15a. Assign Insurance Policy

```
POST /api/v1/journalist/admin/insurance
```

**Payload**
```json
{
  "profileId": "jp_001",
  "type": "ACCIDENTAL",
  "policyNumber": "LIC/ACC/2026/00421",
  "insurer": "LIC of India",
  "coverAmount": 500000,
  "premium": 1200,
  "validFrom": "2026-04-01",
  "validTo": "2027-03-31",
  "notes": "Group policy via TWJF annual scheme"
}
```

| Type | Values |
|------|--------|
| `type` | `ACCIDENTAL` \| `HEALTH` |

> Previous active policy of the **same type** for this member is auto-deactivated.

**Response 201**
```json
{
  "message": "Insurance assigned",
  "insurance": {
    "id": "ins_001",
    "profileId": "jp_001",
    "type": "ACCIDENTAL",
    "policyNumber": "LIC/ACC/2026/00421",
    "insurer": "LIC of India",
    "coverAmount": 500000,
    "premium": 1200,
    "validFrom": "2026-04-01T00:00:00Z",
    "validTo": "2027-03-31T00:00:00Z",
    "isActive": true,
    "notes": "Group policy via TWJF annual scheme",
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

### 15b. Update Insurance Policy

```
PATCH /api/v1/journalist/admin/insurance/:id
```

**Payload** (any combination)
```json
{
  "validTo": "2028-03-31",
  "coverAmount": 1000000,
  "notes": "Renewed and coverage doubled",
  "isActive": true
}
```

### 15c. Get Member's Insurance History

```
GET /api/v1/journalist/admin/insurance/member/:profileId
```

**Response 200**
```json
{
  "insurances": [
    {
      "id": "ins_001",
      "type": "ACCIDENTAL",
      "policyNumber": "LIC/ACC/2026/00421",
      "insurer": "LIC of India",
      "coverAmount": 500000,
      "validFrom": "2026-04-01T00:00:00Z",
      "validTo": "2027-03-31T00:00:00Z",
      "isActive": true,
      "assignedBy": { "profile": { "fullName": "Admin User" } }
    }
  ]
}
```

---

## Step 16 — Admin: Committee / Post Appointments

### 16a. View Post Definitions (Public)

```
GET /api/v1/journalist/posts/definitions?unionName=Telangana+Working+Journalists+Federation&level=STATE
```

**Response 200**
```json
{
  "total": 12,
  "grouped": {
    "STATE": [
      { "id": "pd_001", "title": "State President", "nativeTitle": "రాష్ట్ర అధ్యక్షుడు", "level": "STATE", "type": "ELECTED", "maxSeats": 1, "sortOrder": 1 },
      { "id": "pd_002", "title": "General Secretary", "nativeTitle": "ప్రధాన కార్యదర్శి", "level": "STATE", "type": "ELECTED", "maxSeats": 1, "sortOrder": 4 }
    ],
    "DISTRICT": [ /* ... */ ]
  }
}
```

### 16b. Appoint Member to Post

```
POST /api/v1/journalist/admin/posts/appoint
```

**Payload**
```json
{
  "postId": "pd_001",
  "profileId": "jp_001",
  "termStartDate": "2026-01-01",
  "termEndDate": "2028-12-31",
  "notes": "Elected at AGM 2026"
}
```

> For DISTRICT/MANDAL posts, also pass `districtId` / `mandalId`.  
> For single-seat ELECTED posts: if seat is full, the **previous holder is auto-vacated**.  
> For multi-seat posts: returns 400 if `maxSeats` limit reached.

**Response 201**
```json
{
  "message": "Ravi Kumar appointed as State President",
  "holder": {
    "id": "ph_001",
    "postId": "pd_001",
    "profileId": "jp_001",
    "unionName": "Telangana Working Journalists Federation",
    "termStartDate": "2026-01-01T00:00:00Z",
    "termEndDate": "2028-12-31T00:00:00Z",
    "isActive": true,
    "post": { "title": "State President", "nativeTitle": "రాష్ట్ర అధ్యక్షుడు", "level": "STATE", "type": "ELECTED" },
    "profile": { "pressId": "TWJF-2026-001", "user": { "profile": { "fullName": "Ravi Kumar" } } }
  }
}
```

### 16c. Update Post Holder (Extend Term)

```
PATCH /api/v1/journalist/admin/posts/holders/:id
```

**Payload**
```json
{
  "termEndDate": "2030-12-31",
  "notes": "Term extended at emergency meeting"
}
```

### 16d. Remove / Vacate Post Holder

```
DELETE /api/v1/journalist/admin/posts/holders/:id
```

**Response 200**
```json
{ "message": "Post vacated successfully" }
```

### 16e. View Public Committee (No Auth)

```
GET /api/v1/journalist/committee?unionName=Telangana+Working+Journalists+Federation&level=STATE
```

**Response 200**
```json
{
  "unionName": "Telangana Working Journalists Federation",
  "grouped": {
    "STATE": [
      {
        "holderId": "ph_001",
        "post": { "title": "State President", "nativeTitle": "రాష్ట్ర అధ్యక్షుడు", "level": "STATE", "type": "ELECTED" },
        "member": {
          "profileId": "jp_001",
          "name": "Ravi Kumar",
          "mobile": "9876543210",
          "designation": "Senior Reporter",
          "district": "Hyderabad",
          "organization": "Sakshi TV",
          "pressId": "TWJF-2026-001"
        },
        "termStartDate": "2026-01-01T00:00:00Z",
        "termEndDate": "2028-12-31T00:00:00Z"
      }
    ]
  }
}
```

---

## Step 17 — Public Pages (No Auth)

### 17a. Member Directory

```
GET /api/v1/journalist/directory?district=Hyderabad&unionName=TWJF&page=1&limit=20
```

**Response 200**
```json
{
  "total": 120,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "jp_001",
      "name": "Ravi Kumar",
      "designation": "Senior Reporter",
      "district": "Hyderabad",
      "organization": "Sakshi TV",
      "unionName": "Telangana Working Journalists Federation",
      "pressId": "TWJF-2026-001"
    }
  ]
}
```

### 17b. Union Announcements Feed

```
GET /api/v1/journalist/updates?unionName=TWJF&page=1&limit=10
```

**Response 200**
```json
{
  "total": 8,
  "page": 1,
  "limit": 10,
  "data": [
    {
      "id": "upd_001",
      "title": "Annual General Meeting - 2026",
      "content": "Dear members...",
      "unionName": "Telangana Working Journalists Federation",
      "imageUrl": null,
      "createdAt": "2026-01-15T10:00:00Z",
      "createdBy": { "profile": { "fullName": "Admin User" } }
    }
  ]
}
```

### 17c. Public Union Settings (Branding)

```
GET /api/v1/journalist/public/settings/:unionName
GET /api/v1/journalist/public/settings/:unionName/state/:state
```

### 17d. Download Press Card PDF (QR Scan Link)

```
GET /api/v1/journalist/press-card/pdf?cardNumber=JU-1705312800000
```

Returns PDF binary (`application/pdf`).

```typescript
// Use as iframe src or download link
<a
  href={`${BASE}/api/v1/journalist/press-card/pdf?cardNumber=${card.cardNumber}`}
  target="_blank"
  rel="noopener noreferrer"
>
  Download Press Card
</a>
```

---

## Step 18 — Member APIs (JWT Required)

These are used in the member-facing app / portal:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/journalist/apply` | POST | Apply using existing JWT account |
| `/api/v1/journalist/profile` | GET | Get my profile |
| `/api/v1/journalist/profile` | PUT | Update profile (before approval only) |
| `/api/v1/journalist/my-card` | GET | Get my press card details |
| `/api/v1/journalist/my-card/pdf` | GET | Download my press card as PDF |
| `/api/v1/journalist/my-card/request-renewal` | POST | Request renewal (within 60 days of expiry) |
| `/api/v1/journalist/complaint` | POST | File a complaint (approved members only) |
| `/api/v1/journalist/my-complaints` | GET | List my complaints |
| `/api/v1/journalist/reporter-link` | GET | Check if linked to a reporter account |
| `/api/v1/journalist/my-posts` | GET | Get posts I currently hold |
| `/api/v1/journalist/kyc/upload` | POST | Upload photo/aadhaar (multipart) |
| `/api/v1/journalist/kyc/details` | PUT | Update KYC text fields |
| `/api/v1/journalist/my-insurance` | GET | View my insurance policies |

### Request Renewal (Member)

```
POST /api/v1/journalist/my-card/request-renewal
```

No body needed.

**Response 200**
```json
{
  "message": "Renewal request submitted. Your admin will process it shortly.",
  "card": {
    "pendingRenewal": true,
    "pendingRenewalAt": "2027-01-03T10:00:00Z",
    "expiryDate": "2027-01-15T00:00:00Z"
  }
}
```

**Error 400** (too early)
```json
{
  "error": "Card renewal can only be requested within 60 days of expiry. Your card expires on 15/01/2027 (90 days remaining)."
}
```

---

## Complete Admin Flow Summary

```
SuperAdmin Login
  │
  ├─ Assign Union Admin (POST /admin/assign-union-admin)
  │
  ├─ Seed Post Definitions (POST /admin/posts/seed-defaults)
  │
  └─ Union Admin Login
       │
       ├─ Configure Settings
       │    ├─ PUT /admin/settings          → branding text
       │    ├─ PUT /admin/settings/state    → state contact
       │    ├─ POST /admin/settings/upload  → logo, stamp
       │    └─ POST /admin/settings/state/upload → president signature
       │
       ├─ Applications Dashboard
       │    ├─ GET /admin/applications?approved=false
       │    ├─ PATCH /admin/approve/:id     → approve + pressId
       │    └─ POST /admin/generate-card    → issue card
       │
       ├─ KYC Management
       │    └─ PATCH /admin/kyc/verify/:profileId
       │
       ├─ Renewals Dashboard
       │    ├─ GET /admin/cards/renewal-due
       │    └─ PATCH /admin/cards/:profileId/renew
       │
       ├─ Complaints
       │    ├─ GET /admin/complaints
       │    └─ PATCH /admin/complaints/:id
       │
       ├─ Announcements
       │    ├─ POST /admin/updates
       │    └─ DELETE /admin/updates/:id
       │
       ├─ Insurance
       │    ├─ POST /admin/insurance
       │    ├─ PATCH /admin/insurance/:id
       │    └─ GET /admin/insurance/member/:profileId
       │
       └─ Committee / Posts
            ├─ POST /admin/posts/appoint
            ├─ PATCH /admin/posts/holders/:id
            └─ DELETE /admin/posts/holders/:id
```

---

## Error Reference

| HTTP | Meaning |
|------|---------|
| 400 | Missing/invalid fields — check `error` message |
| 401 | Missing or expired token |
| 403 | Token valid but role insufficient / union scope mismatch |
| 404 | Record not found |
| 409 | Duplicate (e.g. pressId already in use) |
| 500 | Internal server error (check server logs) |

---

## Environment Variables (Next.js)

```env
# .env.local
NEXT_PUBLIC_API_URL=https://api.kaburlu.com
```
