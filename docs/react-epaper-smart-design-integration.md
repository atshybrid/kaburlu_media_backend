# ePaper Smart Design — Complete API & React Integration

**Swagger tag:** `ePaper Smart Design`  
**Base URL:** `https://api.kaburlumedia.com/api/v1`  
**Local:** `http://localhost:3001/api/v1`

Use **only** these APIs for the new Super Admin ePaper Design UI. Do **not** use legacy `/epaper/design-config`.

---

## Authentication & headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <JWT>` — SUPER_ADMIN, TENANT_ADMIN, ADMIN_EDITOR, or DESK_EDITOR |
| `X-Tenant-Id` | SUPER_ADMIN: **Yes** | Tenant to manage |
| `X-Tenant-Slug` | Optional | Alternative tenant selector |
| `X-Tenant-Domain` | Optional | e.g. `epaper.example.com` |

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
X-Tenant-Id: cltenant_abc123
Content-Type: application/json
```

**403** — not admin: `{ "error": "Admin access required" }`  
**400** — no tenant: `{ "error": "Tenant context required (X-Tenant-Id)" }`

---

## API index

| # | Method | Path | Purpose |
|---|--------|------|---------|
| 1 | GET | `/epaper/smart-design/header-styles` | Main + sub style catalog |
| 2 | GET | `/admin/epaper/header-styles` | Same catalog (SUPER_ADMIN only) |
| 3 | GET | `/epaper/smart-design/context` | PRGI, domain, editions, `hasDesign` |
| 4 | GET | `/epaper/smart-design` | List designs |
| 5 | POST | `/epaper/smart-design` | Create (one per edition/sub-edition) |
| 6 | GET | `/epaper/smart-design/{id}` | Get one + `today` |
| 7 | PUT | `/epaper/smart-design/{id}` | Update (send changed fields) |
| 8 | PATCH | `/epaper/smart-design/{id}` | Partial update (same as PUT) |
| 9 | DELETE | `/epaper/smart-design/{id}` | Soft delete |

**Related (editions):** `GET/POST /epaper/publication-editions`, `GET/POST /epaper/publication-editions/{editionId}/sub-editions` — tag `EPF ePaper - Admin`.

---

## Shared response: `EpaperSmartDesign` object

Returned inside `design` or `items[]`:

```json
{
  "id": "clsd_xyz789",
  "tenantId": "cltenant_abc123",
  "publicationEditionId": "ed_telangana",
  "subEditionId": null,
  "subEditionScopeKey": "",
  "paperType": "TABLOID",
  "totalPages": 12,
  "perPageCostMonthly": 2500,
  "paperSellCost": 6,
  "headerStyleNumber": 2,
  "subHeaderStyleNumber": 1,
  "headerStyleKey": "main_style2",
  "subHeaderStyleKey": "sub_header_style1",
  "headerData": "తెలుగుప్రభ",
  "headerLogoUrl": "https://cdn.example.com/epaper/logo.png",
  "subHeaderLogoUrl": "https://cdn.example.com/epaper/sub-logo.png",
  "paperNameImageUrl": null,
  "headerLeftImageUrl": "https://cdn.example.com/epaper/ad-left.png",
  "headerRightImageUrl": "https://cdn.example.com/epaper/ad-right.png",
  "publishedAreaText": "Hyderabad • Warangal • Nizamabad",
  "tagline": "Truth First",
  "websiteUrl": "https://epaper.telugudaily.com",
  "runningCommentText": null,
  "runningCommentAuthor": "Editor",
  "rightArticleTitle": null,
  "rightArticlePoints": null,
  "lastPageFooterText": "Printed at Hyderabad. RNI TELENG/2024/12345",
  "volumeStartNumber": 1,
  "volumeStartYear": 2024,
  "issueStartNumber": 1,
  "issueStartDate": "2024-01-01T00:00:00.000Z",
  "issueCounterMode": "SEQUENTIAL",
  "newsCloseTime": "23:00",
  "languageCode": "te",
  "isActive": true,
  "styleCapabilities": {
    "mainHeader": {
      "number": 2,
      "key": "main_style2",
      "slug": "prabha_3_col_meta_strip",
      "name": "Prabha 3-Col + Meta Strip",
      "nameTe": "ప్రభ 3-కాలమ్ + మెటా స్ట్రిప్",
      "type": "MAIN",
      "supportsCenterLogo": true,
      "supportsLeftImage": true,
      "supportsRightImage": true,
      "supportsPaperNameImage": true,
      "supportsSubHeaderCenterImage": false
    },
    "subHeader": {
      "number": 1,
      "key": "sub_header_style1",
      "slug": "page_logo_date",
      "name": "Page · Logo · Date",
      "nameTe": "పేజీ · లోగో · తేదీ",
      "type": "SUB",
      "supportsSubHeaderCenterImage": true
    },
    "allowedFields": {
      "headerLogoUrl": true,
      "headerLeftImageUrl": true,
      "headerRightImageUrl": true,
      "paperNameImageUrl": true,
      "subHeaderLogoUrl": true
    }
  },
  "publicationEdition": {
    "id": "ed_telangana",
    "name": "Telangana Edition",
    "slug": "telangana"
  },
  "subEdition": null,
  "today": {
    "issueDate": "2026-05-28",
    "dayNameTelugu": "బుధవారం",
    "currentVolume": 3,
    "currentIssue": 148,
    "maxIssuePerYear": 365,
    "newsWindow": {
      "fromDate": "2026-05-28T00:00:00+05:30",
      "toDate": "2026-05-28T23:00:00+05:30"
    }
  },
  "createdAt": "2026-05-20T10:00:00.000Z",
  "updatedAt": "2026-05-28T08:30:00.000Z"
}
```

### `today` (auto-computed on every GET)

| Field | Rule |
|-------|------|
| `currentVolume` | `volumeStartNumber + (currentYear - volumeStartYear)` |
| `currentIssue` | `SEQUENTIAL`: `issueStartNumber + days since issueStartDate`; `DAY_OF_YEAR`: day 1–365 |
| `dayNameTelugu` | Weekday in Telugu when `languageCode` is `te` |
| `maxIssuePerYear` | Always `365` |

---

## 1. GET `/epaper/smart-design/header-styles`

Header style dropdowns (page 1 main + page 2+ sub).

### Request

```http
GET /api/v1/epaper/smart-design/header-styles
Authorization: Bearer <token>
```

No body. `X-Tenant-Id` optional for this endpoint.

### Response `200`

```json
{
  "source": "database",
  "mainHeaders": [
    {
      "id": 1,
      "number": 1,
      "type": "MAIN",
      "key": "main_style1",
      "slug": "classic_3_col_info_bar",
      "name": "Classic 3-Col + Info Bar",
      "nameTe": "క్లాసిక్ 3-కాలమ్ + ఇన్ఫో బార్",
      "supportsCenterLogo": true,
      "supportsLeftImage": true,
      "supportsRightImage": true,
      "supportsPaperNameImage": true,
      "supportsSubHeaderCenterImage": false
    },
    {
      "id": 2,
      "number": 2,
      "type": "MAIN",
      "key": "main_style2",
      "slug": "prabha_3_col_meta_strip",
      "name": "Prabha 3-Col + Meta Strip",
      "nameTe": "ప్రభ 3-కాలమ్ + మెటా స్ట్రిప్",
      "supportsCenterLogo": true,
      "supportsLeftImage": true,
      "supportsRightImage": true,
      "supportsPaperNameImage": true,
      "supportsSubHeaderCenterImage": false
    }
  ],
  "subHeaders": [
    {
      "id": 11,
      "number": 1,
      "type": "SUB",
      "key": "sub_header_style1",
      "slug": "page_logo_date",
      "name": "Page · Logo · Date",
      "nameTe": "పేజీ · లోగో · తేదీ",
      "supportsCenterLogo": false,
      "supportsLeftImage": false,
      "supportsRightImage": false,
      "supportsPaperNameImage": false,
      "supportsSubHeaderCenterImage": true
    }
  ],
  "all": []
}
```

If DB not seeded, `source` is `"catalog"` and shapes match (without `id`).

### Main header keys (1–10)

| # | key | slug |
|---|-----|------|
| 1 | `main_style1` | `classic_3_col_info_bar` |
| 2 | `main_style2` | `prabha_3_col_meta_strip` |
| 3 | `main_style3` | `minimal_white_left_align` |
| 4 | `main_style4` | `red_crimson_banner` |
| 5 | `main_style5` | `split_name_ad_panel` |
| 6 | `main_style6` | `traditional_telugu_ornament` |
| 7 | `main_style7` | `black_gold_premium` |
| 8 | `main_style8` | `blue_gradient` |
| 9 | `main_style9` | `heavy_rules_gothic` |
| 10 | `main_style10` | `modern_color_stripe` |

### Sub header keys (1–10)

| # | key | slug |
|---|-----|------|
| 1 | `sub_header_style1` | `page_logo_date` |
| 2 | `sub_header_style2` | `full_color_bar` |
| 3 | `sub_header_style3` | `slim_rule_line` |
| 4 | `sub_header_style4` | `edition_name_strip` |
| 5 | `sub_header_style5` | `gradient_band` |
| 6 | `sub_header_style6` | `dual_logo_bar` |
| 7 | `sub_header_style7` | `minimal_grey` |
| 8 | `sub_header_style8` | `district_highlight` |
| 9 | `sub_header_style9` | `ornament_border` |
| 10 | `sub_header_style10` | `traditional_telugu` |

**React:** Show upload fields only when the selected style’s `supports*` flag is `true`.

---

## 2. GET `/admin/epaper/header-styles`

Same response as §1. **SUPER_ADMIN role only.**

```http
GET /api/v1/admin/epaper/header-styles
Authorization: Bearer <SUPER_ADMIN_JWT>
```

**403:** `{ "error": "Superadmin only" }`

---

## 3. GET `/epaper/smart-design/context`

Load first on tenant ePaper setup screen.

### Request

```http
GET /api/v1/epaper/smart-design/context
Authorization: Bearer <token>
X-Tenant-Id: cltenant_abc123
```

### Response `200`

```json
{
  "tenantId": "cltenant_abc123",
  "tenantName": "Telugu Daily",
  "tenantSlug": "telugu-daily",
  "prgiNumber": "TELENG/2024/12345",
  "prgiStatus": "VERIFIED",
  "epaperDomain": "epaper.telugudaily.com",
  "epaperDomainId": "cldom_epaper1",
  "totalDesigns": 2,
  "editions": [
    {
      "id": "ed_telangana",
      "name": "Telangana Edition",
      "slug": "telangana",
      "state": { "id": "st_tg", "name": "Telangana" },
      "subEditions": [
        {
          "id": "sub_hyd",
          "name": "Hyderabad",
          "slug": "hyderabad",
          "districtId": "dist_hyd"
        },
        {
          "id": "sub_wgl",
          "name": "Warangal",
          "slug": "warangal",
          "districtId": "dist_wgl"
        }
      ],
      "hasDesign": true,
      "designIds": ["clsd_main_tg", "clsd_hyd"]
    },
    {
      "id": "ed_andhra",
      "name": "Andhra Edition",
      "slug": "andhra",
      "state": { "id": "st_ap", "name": "Andhra Pradesh" },
      "subEditions": [],
      "hasDesign": false,
      "designIds": []
    }
  ],
  "headerStyles": {
    "mainHeaders": [],
    "subHeaders": [],
    "all": []
  }
}
```

**404:** `{ "error": "Tenant not found" }`

**React UI:**

- Display `prgiNumber`, `epaperDomain`, `totalPages` planning section
- Table: edition name → Configure / Edit if `hasDesign`
- Sub-edition rows → separate design (`subEditionId` on POST)

---

## 4. GET `/epaper/smart-design`

### Request

```http
GET /api/v1/epaper/smart-design
Authorization: Bearer <token>
X-Tenant-Id: cltenant_abc123
```

Optional query:

```http
GET /api/v1/epaper/smart-design?publicationEditionId=ed_telangana
```

### Response `200`

```json
{
  "tenantId": "cltenant_abc123",
  "total": 2,
  "items": [
    {
      "id": "clsd_main_tg",
      "publicationEditionId": "ed_telangana",
      "subEditionId": null,
      "totalPages": 12,
      "paperSellCost": 6,
      "headerStyleKey": "main_style2",
      "today": {
        "issueDate": "2026-05-28",
        "dayNameTelugu": "బుధవారం",
        "currentVolume": 3,
        "currentIssue": 148,
        "maxIssuePerYear": 365
      }
    },
    {
      "id": "clsd_hyd",
      "publicationEditionId": "ed_telangana",
      "subEditionId": "sub_hyd",
      "totalPages": 8,
      "today": {
        "currentVolume": 3,
        "currentIssue": 148
      }
    }
  ]
}
```

Each item is full `EpaperSmartDesign` (see shared object above).

---

## 5. POST `/epaper/smart-design`

**One row per** `(tenantId + publicationEditionId + subEditionId)`.

### Required fields (create)

| Field | Type | Description |
|-------|------|-------------|
| `publicationEditionId` | string | From `context.editions` or `GET /publication-editions` |
| `issueStartDate` | string | `YYYY-MM-DD` — first day issue counting starts |

### Recommended fields

| Field | Type | Description |
|-------|------|-------------|
| `subEditionId` | string \| null | Omit for state edition; set for district paper |
| `paperType` | string | `TABLOID` \| `BROADSHEET` (default `TABLOID`) |
| `totalPages` | number | Pages per daily issue (default 8) |
| `perPageCostMonthly` | number | Design cost per page per month (INR) |
| `paperSellCost` | number | Retail price per complete paper |
| `headerStyleNumber` | 1–10 | Main page header style |
| `subHeaderStyleNumber` | 1–10 | Inner pages header style |
| `headerStyleKey` | string | e.g. `main_style2` (synced with number) |
| `subHeaderStyleKey` | string | e.g. `sub_header_style1` |
| `headerData` | string | Newspaper title text (Telugu) |
| `headerLogoUrl` | string | Center logo (page 1) |
| `subHeaderLogoUrl` | string | Center image page 2+ |
| `paperNameImageUrl` | string | Masthead image if style supports |
| `headerLeftImageUrl` | string | Ad / image left (style-dependent) |
| `headerRightImageUrl` | string | Ad / image right |
| `publishedAreaText` | string | Optional circulation areas |
| `tagline` | string | |
| `websiteUrl` | string | |
| `runningCommentText` | string | |
| `runningCommentAuthor` | string | |
| `rightArticleTitle` | string | |
| `rightArticlePoints` | string | |
| `lastPageFooterText` | string | Last page footer / press line |
| `volumeStartNumber` | number | Default `1` |
| `volumeStartYear` | number | Volume increments each calendar year |
| `issueStartNumber` | number | 1–365, default `1` |
| `issueCounterMode` | string | `SEQUENTIAL` (daily +1) or `DAY_OF_YEAR` |
| `newsCloseTime` | string | `HH:MM` IST, default `23:00` |
| `languageCode` | string | `te` for Telugu day name |

### Request — JSON

```http
POST /api/v1/epaper/smart-design
Authorization: Bearer <token>
X-Tenant-Id: cltenant_abc123
Content-Type: application/json
```

```json
{
  "publicationEditionId": "ed_telangana",
  "subEditionId": null,
  "paperType": "TABLOID",
  "totalPages": 12,
  "perPageCostMonthly": 2500,
  "paperSellCost": 6,
  "headerStyleNumber": 2,
  "subHeaderStyleNumber": 1,
  "headerStyleKey": "main_style2",
  "subHeaderStyleKey": "sub_header_style1",
  "headerData": "తెలుగుప్రభ",
  "headerLogoUrl": "https://cdn.example.com/logo.png",
  "headerLeftImageUrl": "https://cdn.example.com/ad-left.png",
  "headerRightImageUrl": "https://cdn.example.com/ad-right.png",
  "publishedAreaText": "Hyderabad • Warangal • Nizamabad",
  "tagline": "Truth First",
  "websiteUrl": "https://epaper.telugudaily.com",
  "lastPageFooterText": "Printed at Hyderabad. Publisher: Telugu Daily.",
  "volumeStartNumber": 1,
  "volumeStartYear": 2024,
  "issueStartNumber": 1,
  "issueStartDate": "2024-01-01",
  "issueCounterMode": "SEQUENTIAL",
  "newsCloseTime": "23:00",
  "languageCode": "te"
}
```

### Request — multipart (image upload)

```http
POST /api/v1/epaper/smart-design
Authorization: Bearer <token>
X-Tenant-Id: cltenant_abc123
Content-Type: multipart/form-data
```

| Form field | Type | Maps to |
|------------|------|---------|
| `publicationEditionId` | text | required |
| `issueStartDate` | text | `2024-01-01` |
| `headerStyleNumber` | text | `2` |
| `totalPages` | text | `12` |
| `headerLogo` | file | → `headerLogoUrl` |
| `subHeaderLogo` | file | → `subHeaderLogoUrl` |
| `headerLeftImage` | file | → `headerLeftImageUrl` |
| `headerRightImage` | file | → `headerRightImageUrl` |
| `paperNameImage` | file | → `paperNameImageUrl` |

Max image size: `MEDIA_MAX_IMAGE_MB` env (default 10 MB).

### Response `201`

```json
{
  "success": true,
  "prgiNumber": "TELENG/2024/12345",
  "epaperDomain": "epaper.telugudaily.com",
  "design": {
    "id": "clsd_xyz789",
    "publicationEditionId": "ed_telangana",
    "headerStyleKey": "main_style2",
    "today": {
      "issueDate": "2026-05-28",
      "dayNameTelugu": "బుధవారం",
      "currentVolume": 3,
      "currentIssue": 148,
      "maxIssuePerYear": 365
    }
  }
}
```

### Errors

| Status | Body |
|--------|------|
| 400 | `{ "error": "publicationEditionId is required" }` |
| 400 | `{ "error": "Invalid publicationEditionId" }` |
| 400 | `{ "error": "Invalid subEditionId for this edition" }` |
| 400 | `{ "error": "issueStartDate is required (YYYY-MM-DD)" }` |
| 400 | `{ "error": "issueStartNumber must be between 1 and 365" }` |
| 400 | `{ "error": "newsCloseTime must be HH:MM" }` |
| 409 | `{ "error": "Design already exists...", "existingId": "clsd_xyz789" }` |

**District sub-edition example:**

```json
{
  "publicationEditionId": "ed_telangana",
  "subEditionId": "sub_hyd",
  "totalPages": 8,
  "issueStartDate": "2024-01-01",
  "headerStyleNumber": 5,
  "subHeaderStyleNumber": 4
}
```

---

## 6. GET `/epaper/smart-design/{id}`

### Request

```http
GET /api/v1/epaper/smart-design/clsd_xyz789
Authorization: Bearer <token>
X-Tenant-Id: cltenant_abc123
```

### Response `200`

```json
{
  "design": { },
  "prgiNumber": "TELENG/2024/12345",
  "epaperDomain": "epaper.telugudaily.com"
}
```

`design` = full object (§ Shared response).

**404:** `{ "error": "Smart design not found" }`

---

## 7. PUT `/epaper/smart-design/{id}`

Send only fields to change (or full object). Supports JSON or multipart (same file fields as POST).

### Request

```http
PUT /api/v1/epaper/smart-design/clsd_xyz789
Authorization: Bearer <token>
X-Tenant-Id: cltenant_abc123
Content-Type: application/json
```

```json
{
  "totalPages": 16,
  "paperSellCost": 7,
  "headerStyleNumber": 5,
  "subHeaderStyleNumber": 2,
  "publishedAreaText": "Hyderabad • Secunderabad",
  "lastPageFooterText": "Updated footer line"
}
```

### Response `200`

```json
{
  "success": true,
  "design": {
    "id": "clsd_xyz789",
    "totalPages": 16,
    "paperSellCost": 7,
    "styleCapabilities": {
      "allowedFields": {
        "headerLogoUrl": true,
        "headerLeftImageUrl": true,
        "headerRightImageUrl": true,
        "paperNameImageUrl": true,
        "subHeaderLogoUrl": true
      }
    },
    "today": {
      "currentVolume": 3,
      "currentIssue": 148
    }
  }
}
```

---

## 8. PATCH `/epaper/smart-design/{id}`

Identical to PUT — partial update only.

```http
PATCH /api/v1/epaper/smart-design/clsd_xyz789
Content-Type: application/json

{ "paperSellCost": 8, "tagline": "New tagline" }
```

Response same as PUT `200`.

---

## 9. DELETE `/epaper/smart-design/{id}`

Soft delete (`isDeleted: true`).

### Request

```http
DELETE /api/v1/epaper/smart-design/clsd_xyz789
Authorization: Bearer <token>
X-Tenant-Id: cltenant_abc123
```

### Response `200`

```json
{
  "success": true,
  "id": "clsd_xyz789",
  "message": "Smart design deleted"
}
```

**404:** `{ "error": "Smart design not found" }`

---

## Edition APIs (setup before POST)

### GET list editions

```http
GET /api/v1/epaper/publication-editions?includeSubEditions=true
Authorization: Bearer <token>
X-Tenant-Id: cltenant_abc123
```

```json
{
  "items": [
    {
      "id": "ed_telangana",
      "tenantId": "cltenant_abc123",
      "name": "Telangana Edition",
      "slug": "telangana",
      "stateId": "st_tg",
      "isActive": true,
      "isDeleted": false,
      "state": { "id": "st_tg", "name": "Telangana" },
      "subEditions": [
        { "id": "sub_hyd", "name": "Hyderabad", "slug": "hyderabad" }
      ]
    }
  ]
}
```

### POST create edition

```http
POST /api/v1/epaper/publication-editions
X-Tenant-Id: cltenant_abc123
Content-Type: application/json
```

```json
{
  "name": "Telangana Edition",
  "slug": "telangana",
  "stateId": "st_tg",
  "isActive": true
}
```

**201:** created edition object with `id` → use as `publicationEditionId`.

### POST create sub-edition

```http
POST /api/v1/epaper/publication-editions/ed_telangana/sub-editions
```

```json
{
  "name": "Hyderabad Edition",
  "slug": "hyderabad",
  "districtId": "dist_hyd",
  "isActive": true
}
```

---

## React integration

### Screen flow

```mermaid
flowchart TD
  A[Tenant picker] --> B[GET /smart-design/context]
  B --> C{Edition has design?}
  C -->|no| D[GET /header-styles]
  D --> E[Form: styles + images + pages/cost]
  E --> F[POST /smart-design]
  C -->|yes| G[GET /smart-design/:id]
  G --> H[PATCH updates]
  B --> I[Create edition if missing]
  I --> J[POST /publication-editions]
```

### TypeScript client (`src/api/epaperSmartDesignService.ts`)

```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.kaburlumedia.com/api/v1';

export type HeaderStyleItem = {
  number: number;
  key: string;
  slug: string;
  name: string;
  nameTe?: string;
  type: 'MAIN' | 'SUB';
  supportsCenterLogo: boolean;
  supportsLeftImage: boolean;
  supportsRightImage: boolean;
  supportsPaperNameImage: boolean;
  supportsSubHeaderCenterImage: boolean;
};

export type SmartDesignToday = {
  issueDate: string;
  dayNameTelugu: string;
  currentVolume: number;
  currentIssue: number;
  maxIssuePerYear: number;
  newsWindow: { fromDate: string; toDate: string };
};

export type EpaperSmartDesign = {
  id: string;
  publicationEditionId: string;
  subEditionId: string | null;
  paperType: string;
  totalPages: number;
  perPageCostMonthly: number | null;
  paperSellCost: number | null;
  headerStyleNumber: number;
  subHeaderStyleNumber: number;
  headerStyleKey: string;
  subHeaderStyleKey: string;
  headerData: string | null;
  headerLogoUrl: string | null;
  subHeaderLogoUrl: string | null;
  paperNameImageUrl: string | null;
  headerLeftImageUrl: string | null;
  headerRightImageUrl: string | null;
  publishedAreaText: string | null;
  lastPageFooterText: string | null;
  volumeStartYear: number;
  issueStartDate: string;
  issueCounterMode: string;
  styleCapabilities: {
    allowedFields: Record<string, boolean>;
    mainHeader: HeaderStyleItem;
    subHeader: HeaderStyleItem;
  };
  today: SmartDesignToday;
  publicationEdition?: { id: string; name: string; slug: string };
  subEdition?: { id: string; name: string; slug: string } | null;
};

function authHeaders(tenantId: string, token: string, json = true) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error((data as { error?: string }).error || res.statusText), { status: res.status, data });
  return data as T;
}

export const epaperSmartDesignApi = {
  headerStyles(token: string) {
    return fetch(`${API_BASE}/epaper/smart-design/header-styles`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => parseJson<{ mainHeaders: HeaderStyleItem[]; subHeaders: HeaderStyleItem[] }>(r));
  },

  context(tenantId: string, token: string) {
    return fetch(`${API_BASE}/epaper/smart-design/context`, {
      headers: authHeaders(tenantId, token),
    }).then((r) => parseJson<{
      tenantId: string;
      tenantName: string;
      prgiNumber: string;
      epaperDomain: string | null;
      editions: Array<{
        id: string;
        name: string;
        slug: string;
        hasDesign: boolean;
        designIds: string[];
        subEditions: Array<{ id: string; name: string; slug: string }>;
      }>;
    }>(r));
  },

  list(tenantId: string, token: string, publicationEditionId?: string) {
    const q = publicationEditionId ? `?publicationEditionId=${encodeURIComponent(publicationEditionId)}` : '';
    return fetch(`${API_BASE}/epaper/smart-design${q}`, {
      headers: authHeaders(tenantId, token),
    }).then((r) => parseJson<{ total: number; items: EpaperSmartDesign[] }>(r));
  },

  getById(tenantId: string, token: string, id: string) {
    return fetch(`${API_BASE}/epaper/smart-design/${id}`, {
      headers: authHeaders(tenantId, token),
    }).then((r) => parseJson<{ design: EpaperSmartDesign; prgiNumber: string; epaperDomain: string | null }>(r));
  },

  create(tenantId: string, token: string, body: Record<string, unknown>) {
    return fetch(`${API_BASE}/epaper/smart-design`, {
      method: 'POST',
      headers: authHeaders(tenantId, token),
      body: JSON.stringify(body),
    }).then((r) => parseJson<{ success: boolean; design: EpaperSmartDesign; existingId?: string }>(r));
  },

  createWithFiles(tenantId: string, token: string, formData: FormData) {
    return fetch(`${API_BASE}/epaper/smart-design`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId },
      body: formData,
    }).then((r) => parseJson<{ success: boolean; design: EpaperSmartDesign }>(r));
  },

  patch(tenantId: string, token: string, id: string, body: Record<string, unknown>) {
    return fetch(`${API_BASE}/epaper/smart-design/${id}`, {
      method: 'PATCH',
      headers: authHeaders(tenantId, token),
      body: JSON.stringify(body),
    }).then((r) => parseJson<{ success: boolean; design: EpaperSmartDesign }>(r));
  },

  remove(tenantId: string, token: string, id: string) {
    return fetch(`${API_BASE}/epaper/smart-design/${id}`, {
      method: 'DELETE',
      headers: authHeaders(tenantId, token, false),
    }).then((r) => parseJson<{ success: boolean; id: string }>(r));
  },
};
```

### Form → API field map (UI)

| UI label | API field |
|----------|-----------|
| Paper type (Tabloid/Broadsheet) | `paperType` |
| Total pages per issue | `totalPages` |
| Monthly design cost (all pages) | `perPageCostMonthly` |
| Sell price per paper | `paperSellCost` |
| Main header style | `headerStyleNumber` + `headerStyleKey` |
| Sub header style | `subHeaderStyleNumber` + `subHeaderStyleKey` |
| Newspaper name (Telugu) | `headerData` |
| Center logo (page 1) | `headerLogoUrl` / file `headerLogo` |
| Sub header center image | `subHeaderLogoUrl` / file `subHeaderLogo` |
| Left ad image | `headerLeftImageUrl` / `headerLeftImage` |
| Right ad image | `headerRightImageUrl` / `headerRightImage` |
| Publish areas | `publishedAreaText` |
| Last page footer | `lastPageFooterText` |
| Volume start year | `volumeStartYear` |
| Volume start number | `volumeStartNumber` |
| Issue start date | `issueStartDate` |
| Issue start number | `issueStartNumber` |
| PRGI (read-only) | from `context.prgiNumber` |
| ePaper domain (read-only) | from `context.epaperDomain` |
| Today volume/issue (read-only) | `design.today` |

### Handle 409 on create

```typescript
try {
  await epaperSmartDesignApi.create(tenantId, token, payload);
} catch (e: any) {
  if (e.status === 409 && e.data?.existingId) {
    await epaperSmartDesignApi.patch(tenantId, token, e.data.existingId, payload);
  } else throw e;
}
```

---

## Deploy checklist

1. `npm run migrate:droplet` (production DB)
2. `npx ts-node scripts/seed_epaper_header_styles.ts`
3. `npm run build` + restart API (`pm2 restart kaburlu-api`)
4. Swagger: filter tag **ePaper Smart Design**

---

## Quick reference — all endpoints

```
GET    /api/v1/epaper/smart-design/header-styles
GET    /api/v1/admin/epaper/header-styles
GET    /api/v1/epaper/smart-design/context
GET    /api/v1/epaper/smart-design
GET    /api/v1/epaper/smart-design?publicationEditionId={id}
POST   /api/v1/epaper/smart-design
GET    /api/v1/epaper/smart-design/{id}
PUT    /api/v1/epaper/smart-design/{id}
PATCH  /api/v1/epaper/smart-design/{id}
DELETE /api/v1/epaper/smart-design/{id}
GET    /api/v1/epaper/publication-editions?includeSubEditions=true
POST   /api/v1/epaper/publication-editions
POST   /api/v1/epaper/publication-editions/{editionId}/sub-editions
```
