# ePaper Smart Design — React Super Admin Integration

> **All sample responses (GET/POST/PUT/PATCH/DELETE):** [`epaper-smart-design-api-samples.md`](./epaper-smart-design-api-samples.md)  
> **Full integration guide:** [`react-epaper-smart-design-integration.md`](./react-epaper-smart-design-integration.md)

**Use these APIs only** (not legacy `/epaper/design-config`).

Base: `https://api.kaburlumedia.com/api/v1`

**Swagger UI:** tag **`ePaper Smart Design`** — all endpoints with request/response samples.

```http
Authorization: Bearer <SUPER_ADMIN_JWT>
X-Tenant-Id: <tenantId>
```

---

## Which API for what?

| Need | API |
|------|-----|
| Style dropdown (main/sub) | `GET /epaper/smart-design/header-styles` or `GET /admin/epaper/header-styles` |
| Tenant domain + PRGI + editions list | `GET /epaper/smart-design/context` |
| Edition-wise design CRUD | `/epaper/smart-design` |
| Create publication editions | `/epaper/publication-editions` (existing) |

---

## 1. Load context (first screen)

```http
GET /api/v1/epaper/smart-design/context
X-Tenant-Id: tenant_abc
```

Response (summary):

```json
{
  "tenantId": "tenant_abc",
  "tenantName": "Telugu Daily",
  "prgiNumber": "TELENG/2024/12345",
  "epaperDomain": "epaper.telugudaily.com",
  "editions": [
    {
      "id": "ed_tg",
      "name": "Telangana Edition",
      "slug": "telangana",
      "subEditions": [{ "id": "sub_hyd", "name": "Hyderabad" }],
      "hasDesign": false
    }
  ],
  "headerStyles": { "mainHeaders": [], "subHeaders": [] }
}
```

React: show **PRGI**, **ePaper domain**, editions table. “Configure design” per edition.

---

## 2. Header style catalog

```http
GET /api/v1/epaper/smart-design/header-styles
```

Each style has `number`, `key`, `slug`, `name`, `nameTe`, and flags:

- `supportsCenterLogo`, `supportsLeftImage`, `supportsRightImage`, `supportsPaperNameImage`
- Sub: `supportsSubHeaderCenterImage`

**UI:** hide upload fields when flag is `false` (fixes “Missing API” warnings).

---

## 3. Create design (one POST per edition)

**Rule:** Only **one** design per `(tenant + publicationEdition + subEdition)`.

- Telangana edition (no sub): `subEditionId` omit or `null`
- Hyderabad district: `subEditionId: "sub_hyd"`

```http
POST /api/v1/epaper/smart-design
Content-Type: application/json
# or multipart/form-data for images

{
  "publicationEditionId": "ed_tg",
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
  "headerLogoUrl": "https://cdn.../logo.png",
  "subHeaderLogoUrl": "https://cdn.../sub.png",
  "paperNameImageUrl": "https://cdn.../name.png",
  "headerLeftImageUrl": "https://cdn.../ad-left.png",
  "headerRightImageUrl": "https://cdn.../ad-right.png",

  "publishedAreaText": "Hyderabad • Guntur",
  "tagline": "Truth First",
  "websiteUrl": "https://epaper.example.com",
  "runningCommentText": "...",
  "runningCommentAuthor": "Editor",
  "rightArticleTitle": "...",
  "rightArticlePoints": "point1|point2",
  "lastPageFooterText": "Printed at ... RNI ...",

  "volumeStartNumber": 1,
  "volumeStartYear": 2024,
  "issueStartNumber": 1,
  "issueStartDate": "2024-01-01",
  "issueCounterMode": "SEQUENTIAL",
  "newsCloseTime": "23:00",
  "languageCode": "te"
}
```

**409** if design already exists → use `PUT`/`PATCH` on returned `existingId`.

### Image upload (multipart)

Fields: `headerLeftImage`, `headerRightImage`, `headerLogo`, `subHeaderLogo`, `paperNameImage`  
Same POST; JSON fields in form fields.

---

## 4. List / get / update / delete

| Action | Method | Path |
|--------|--------|------|
| List all | GET | `/epaper/smart-design` |
| Filter by edition | GET | `/epaper/smart-design?publicationEditionId=ed_tg` |
| One | GET | `/epaper/smart-design/:id` |
| Full update | PUT | `/epaper/smart-design/:id` |
| Partial | PATCH | `/epaper/smart-design/:id` |
| Delete | DELETE | `/epaper/smart-design/:id` |

GET response includes:

- `design.today.issueDate`, `dayNameTelugu`, `currentVolume`, `currentIssue`
- `styleCapabilities.allowedFields` — which image URLs are valid for selected styles
- `prgiNumber`, `epaperDomain` (on single GET)

---

## 5. Volume & issue rules

| Field | Behavior |
|-------|----------|
| `volumeStartYear` + `volumeStartNumber` | Volume = startNumber + (currentYear − volumeStartYear) |
| `issueCounterMode: SEQUENTIAL` | Issue = issueStartNumber + days since `issueStartDate` |
| `issueCounterMode: DAY_OF_YEAR` | Issue = day of year (1–365) |
| Max issue | **365** per year cap in API |

Example: publish daily from issue 1 → today issue 2, tomorrow 3.

---

## 6. Editions flow (existing APIs)

```http
GET /api/v1/epaper/publication-editions?includeSubEditions=true
POST /api/v1/epaper/publication-editions
POST /api/v1/epaper/publication-editions/:editionId/sub-editions
```

Treat each **edition** (or **sub-edition**) as one complete daily paper → one **smart-design** row.

---

## 7. React service example

```ts
const API = 'https://api.kaburlumedia.com/api/v1';
const headers = (tenantId: string, token: string) => ({
  Authorization: `Bearer ${token}`,
  'X-Tenant-Id': tenantId,
});

export const epaperSmartDesignApi = {
  context: (tenantId: string, token: string) =>
    fetch(`${API}/epaper/smart-design/context`, { headers: headers(tenantId, token) }).then((r) => r.json()),

  headerStyles: (token: string) =>
    fetch(`${API}/epaper/smart-design/header-styles`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),

  list: (tenantId: string, token: string, editionId?: string) =>
    fetch(`${API}/epaper/smart-design${editionId ? `?publicationEditionId=${editionId}` : ''}`, {
      headers: headers(tenantId, token),
    }).then((r) => r.json()),

  create: (tenantId: string, token: string, body: object) =>
    fetch(`${API}/epaper/smart-design`, {
      method: 'POST',
      headers: { ...headers(tenantId, token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  patch: (tenantId: string, token: string, id: string, body: object) =>
    fetch(`${API}/epaper/smart-design/${id}`, {
      method: 'PATCH',
      headers: { ...headers(tenantId, token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
};
```

---

## 8. Deploy notes

1. Run migration: `npm run migrate:droplet` (production) or `npx prisma migrate deploy` (local DB)
2. Seed styles: `npx ts-node scripts/seed_epaper_header_styles.ts`
3. Old `/epaper/design-config` — keep for backward compatibility; **new UI uses `/epaper/smart-design` only**

---

## 9. Screen checklist

- [ ] Tenant picker → `context`
- [ ] Editions list → create edition/sub-edition if missing
- [ ] Per edition: style dropdowns from `header-styles`
- [ ] Conditional image uploads from `styleCapabilities.allowedFields`
- [ ] POST once; PATCH for edits
- [ ] Show `today.currentVolume`, `today.currentIssue`, `dayNameTelugu` on preview
