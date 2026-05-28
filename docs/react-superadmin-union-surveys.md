# Union Surveys — React Integration (Super Admin + Member)

Base URL: `https://api.kaburlumedia.com/api/v1`

---

## Simple create survey (one API — use this)

```http
POST /api/v1/journalist/admin/surveys
Authorization: Bearer <SUPER_ADMIN_JWT>
```

### Form fields → JSON

| UI field | JSON key |
|----------|----------|
| Survey type dropdown | `surveyType` → `GENERAL` or `PARTY` |
| Party selected (if PARTY) | `politicalPartyId` |
| Survey name | `surveyName` (required) |
| Union | `unionName` — **optional** (one union on server → auto-filled) |
| State | `state` |
| Frame image (optional) | `frameImageUrl` |
| Primary color | `primaryColor` |
| Secondary color | `secondaryColor` |
| Question type | `questionType` → `choice`, `yes_no`, `text`, `video` |
| Question text | `question` |
| Answers list | `answers[]` → `{ id, label, color? }` — **only if** `questionType` = `choice` |

**Rules:** Only **1 question** per survey. No `unionName` needed if you have a single union.

### Where to send `answers` (create survey)

Same `POST /journalist/admin/surveys` body lo — **root level**, `question` pakkana:

| `questionType` | `answers[]` at create? |
|----------------|-------------------------|
| `choice` | **Required** — options member ki chupistayi (BJP, Congress, …) |
| `yes_no` | **No** — server Yes/No options auto |
| `text` | **No** — member free text type chestadu |
| `video` | **No** — member video upload chestadu |

**PARTY survey:** `politicalPartyId` mandatory; `answers` **only** if question type `choice`. Ex-BJP `yes_no` / `video` ki `answers` send cheyakandi.

```json
{
  "surveyType": "PARTY",
  "politicalPartyId": "clx_party_id",
  "surveyName": "Ex-BJP reason",
  "questionType": "choice",
  "question": "Mee previous affiliation?",
  "answers": [
    { "id": "MEMBER", "label": "Still sympathizer" },
    { "id": "LEFT", "label": "Fully left party" }
  ]
}
```

Member **response** (app) — separate API after publish; see section **Member: save answers**.

### Example (flat — easiest for React form)

```json
{
  "surveyType": "GENERAL",
  "surveyName": "2026 Election Prediction",
  "state": "Telangana",
  "primaryColor": "#FF9933",
  "secondaryColor": "#FFFFFF",
  "frameImageUrl": "https://cdn.example.com/frame.png",
  "questionType": "choice",
  "question": "2026 lo ee party gelustundi?",
  "answers": [
    { "id": "BJP", "label": "BJP", "color": "#FF9933" },
    { "id": "CONGRESS", "label": "Congress" },
    { "id": "BRS", "label": "BRS" },
    { "id": "TRS", "label": "TRS" }
  ]
}
```

### Video question (one question only)

```json
{
  "surveyType": "GENERAL",
  "surveyName": "Member video survey",
  "questionType": "video",
  "question": "Frame tho 30 sec video record cheyandi",
  "videoMaxSeconds": 30
}
```

### PARTY type (one question)

**If `surveyType` = `PARTY`:**

| Field | Required? | Notes |
|-------|-----------|--------|
| `politicalPartyId` | **Yes** | From `GET /political-parties/admin?q=BJP` → use `data[0].id` |
| `surveyName` | Yes | |
| `unionName` | No | Same as GENERAL — server auto-fills |
| `primaryColor` / `secondaryColor` / frame | No | Auto from party row (override optional) |
| Question | Yes | Still **only 1** (`questionType` + `question`) |

React UI: when user picks **PARTY**, show **party dropdown** (required). Colors/frame preview can come from selected party — no need to type hex unless overriding.

```json
{
  "surveyType": "PARTY",
  "politicalPartyId": "clx_party_id_from_political-parties_api",
  "surveyName": "Ex-BJP Survey",
  "state": "Telangana",
  "questionType": "yes_no",
  "question": "Are you an ex-BJP member?"
}
```

Party + video (ex-member intro):

```json
{
  "surveyType": "PARTY",
  "politicalPartyId": "clx_party_id",
  "surveyName": "Ex-BJP video survey",
  "questionType": "video",
  "question": "Party frame tho video record cheyandi",
  "videoMaxSeconds": 30
}
```

Load parties for dropdown:

```http
GET /api/v1/political-parties/admin?q=BJP&limit=20
Authorization: Bearer <SUPER_ADMIN_JWT>
```

### After create

```http
POST /journalist/admin/surveys/{id}/publish
POST /journalist/admin/surveys/{id}/assign
{ "allMembers": true }
```

---

## 1. Survey types (simple mental model)

| `surveyType` | When to use | `politicalPartyId` |
|--------------|-------------|-------------------|
| **GENERAL** | Election prediction, opinion polls (BJP / Congress / BRS / TRS options in one question) | Not required (`partyCode` = OTHER) |
| **POLITICAL_PARTY** | Ex-BJP track, party-specific insurance survey | **Required** (link `IndianPoliticalParty.id`) — colors/logo auto-filled |

### Campaign lifecycle

```
DRAFT → (publish) → ACTIVE → (close) → CLOSED
```

Members only see **ACTIVE** surveys assigned to them.

### Review flow (video surveys)

```
Member completes → reviewStatus: PENDING → Super Admin approve/reject
  approve → APPROVED + insurance unlock (if configured)
  reject  → REJECTED → member can answer again
```

---

## 2. Advanced payload (optional)

Prefer the **flat** body in section “Simple create survey” above. If you use nested `questions[]`, send **exactly one** item. Omit `unionName` — server uses `JournalistUnionSettings` / `DEFAULT_UNION_NAME`.

### Example — GENERAL (nested, one question)

```json
{
  "state": "Telangana",
  "surveyType": "GENERAL",
  "displayName": "2026 Election Prediction",
  "primaryColor": "#1A237E",
  "secondaryColor": "#FFFFFF",
  "questions": [
    {
      "questionType": "SINGLE_CHOICE",
      "questionText": "2026 lo ee party gelustundi?",
      "options": [
        { "id": "BJP", "label": "BJP", "color": "#FF9933" },
        { "id": "CONGRESS", "label": "Congress" },
        { "id": "BRS", "label": "BRS" },
        { "id": "TRS", "label": "TRS" }
      ]
    }
  ]
}
```

### Example — POLITICAL_PARTY (one question)

```json
{
  "surveyType": "POLITICAL_PARTY",
  "politicalPartyId": "<IndianPoliticalParty.id>",
  "displayName": "Ex-BJP Members Survey",
  "state": "Telangana",
  "questions": [
    { "questionType": "YES_NO", "questionText": "Are you an ex-BJP member?" }
  ]
}
```

---

## 3. Super Admin API flow

```mermaid
flowchart LR
  A[Create DRAFT] --> B[Publish ACTIVE]
  B --> C[Assign members]
  C --> D[Members answer]
  D --> E{requiresReview?}
  E -->|yes| F[Approve / Reject]
  E -->|no| G[Auto approved]
  F --> H[Area report]
  G --> H
```

| Step | Method | Path |
|------|--------|------|
| 1. Create | POST | `/journalist/admin/surveys` |
| 2. Publish | POST | `/journalist/admin/surveys/{id}/publish` |
| 3. Assign all | POST | `/journalist/admin/surveys/{id}/assign` `{ "allMembers": true }` |
| 3b. Assign selected | POST | same `{ "profileIds": ["..."] }` |
| 3c. Assign by area | POST | same `{ "allMembers": true, "districts": ["Warangal"], "mandals": ["Hanamkonda"] }` |
| 4. List submissions | GET | `/journalist/admin/surveys/{id}/members?reviewStatus=PENDING` |
| 5. View one | GET | `/journalist/admin/surveys/{id}/submissions/{progressId}` |
| 6. Approve | POST | `/journalist/admin/surveys/{id}/submissions/{progressId}/approve` |
| 7. Reject | POST | `/journalist/admin/surveys/{id}/submissions/{progressId}/reject` `{ "note": "Video unclear" }` |
| 8. Area report | GET | `/journalist/admin/surveys/{id}/report/area?state=Telangana&district=Warangal` |
| Close | POST | `/journalist/admin/surveys/{id}/close` |

---

## 4. Member / Tenant reporter API flow

Login: `POST /auth/login` (union member or tenant reporter with `journalistProfile`).

| Step | Method | Path |
|------|--------|------|
| List my surveys | GET | `/journalist/union-member-surveys/campaigns` |
| Survey detail + branding | GET | `/journalist/union-member-surveys/campaigns/{campaignId}` |
| Start | POST | `/journalist/union-member-surveys/campaigns/{campaignId}/start` |
| Save answers | POST | `/journalist/union-member-surveys/campaigns/{campaignId}/answers` |
| Upload video | POST | `/journalist/union-member-surveys/campaigns/{campaignId}/video?questionId=...` |
| Complete | POST | `/journalist/union-member-surveys/campaigns/{campaignId}/complete` |

### Submit SINGLE_CHOICE answer

```json
POST .../campaigns/{campaignId}/answers

{
  "answers": [
    {
      "questionId": "clq_...",
      "answerJson": { "selectedId": "BJP", "value": "BJP" }
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "surveyId": "camp_...",
  "progressId": "prog_...",
  "saved": 1,
  "answers": [
    { "answerId": "ans_...", "questionId": "clq_...", "videoUrl": null }
  ]
}
```

### Upload video (after or before text answers)

```js
const form = new FormData();
form.append('video', file);

const res = await fetch(
  `${API}/journalist/union-member-surveys/campaigns/${campaignId}/video?questionId=${questionId}`,
  { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form }
);
// { surveyId, progressId, questionId, answerId, videoUrl }
```

Use returned **`answerId`** in your UI to track upload per question.

### Complete survey

```json
POST .../complete

{
  "success": true,
  "status": "COMPLETED",
  "reviewStatus": "PENDING",
  "message": "Submitted for admin review"
}
```

---

## 5. React service (copy-paste)

```js
const API = import.meta.env.VITE_API_BASE_URL;
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('kaburlu_jwt')}` });

export const surveyAdminApi = {
  create: (body) =>
    fetch(`${API}/journalist/admin/surveys`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()),

  publish: (id) =>
    fetch(`${API}/journalist/admin/surveys/${id}/publish`, {
      method: 'POST',
      headers: auth(),
    }).then((r) => r.json()),

  assignAll: (id) =>
    fetch(`${API}/journalist/admin/surveys/${id}/assign`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ allMembers: true, approvedOnly: true }),
    }).then((r) => r.json()),

  assignSelected: (id, profileIds) =>
    fetch(`${API}/journalist/admin/surveys/${id}/assign`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileIds }),
    }).then((r) => r.json()),

  pendingSubmissions: (id) =>
    fetch(`${API}/journalist/admin/surveys/${id}/members?reviewStatus=PENDING`, {
      headers: auth(),
    }).then((r) => r.json()),

  approve: (surveyId, progressId, note) =>
    fetch(`${API}/journalist/admin/surveys/${surveyId}/submissions/${progressId}/approve`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    }).then((r) => r.json()),

  reject: (surveyId, progressId, note) =>
    fetch(`${API}/journalist/admin/surveys/${surveyId}/submissions/${progressId}/reject`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    }).then((r) => r.json()),

  areaReport: (id, params = {}) => {
    const q = new URLSearchParams(params);
    return fetch(`${API}/journalist/admin/surveys/${id}/report/area?${q}`, {
      headers: auth(),
    }).then((r) => r.json());
  },
};

export const surveyMemberApi = {
  list: () =>
    fetch(`${API}/journalist/union-member-surveys/campaigns`, { headers: auth() }).then((r) =>
      r.json(),
    ),

  detail: (campaignId) =>
    fetch(`${API}/journalist/union-member-surveys/campaigns/${campaignId}`, {
      headers: auth(),
    }).then((r) => r.json()),

  saveAnswers: (campaignId, answers) =>
    fetch(`${API}/journalist/union-member-surveys/campaigns/${campaignId}/answers`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    }).then((r) => r.json()),

  uploadVideo: async (campaignId, questionId, file) => {
    const form = new FormData();
    form.append('video', file);
    const res = await fetch(
      `${API}/journalist/union-member-surveys/campaigns/${campaignId}/video?questionId=${questionId}`,
      { method: 'POST', headers: auth(), body: form },
    );
    return res.json();
  },

  complete: (campaignId) =>
    fetch(`${API}/journalist/union-member-surveys/campaigns/${campaignId}/complete`, {
      method: 'POST',
      headers: auth(),
    }).then((r) => r.json()),
};
```

---

## 6. UI screens (recommended)

### Super Admin
1. **Survey list** — filter by `surveyType`, state, `campaignStatus`
2. **Create wizard** — Step 1 type + party, Step 2 branding (colors, frame image), Step 3 questions builder
3. **Assign** — tabs: All members | Pick members | By district/mandal
4. **Review queue** — `reviewStatus=PENDING`, play video, Approve / Reject
5. **Reports** — map/table by district with `choiceBreakdown` (BJP vs BRS counts)

### Member app
1. **My surveys** card list with `branding.primaryColor` border
2. **Survey screen** — show `frameImageUrl` overlay on camera for VIDEO_UPLOAD
3. **Submit** — save choice → upload video → complete → show “Waiting for admin approval”

---

## 7. Load party options from API (GENERAL survey builder)

```js
// When building SINGLE_CHOICE options for 2026 poll:
const parties = await fetch(`${API}/political-parties?recognition=NATIONAL&limit=20`).then((r) => r.json());

const options = parties.items.map((p) => ({
  id: p.shortCode,
  label: p.abbreviation || p.shortCode,
  color: p.primaryColor,
  symbolUrl: p.symbolImageUrl,
  partyId: p.id,
}));
```

---

## 8. Swagger

- **Journalist Union — Super Admin** → `/journalist/admin/surveys`
- **Journalist Union — Survey (Member)** → `/journalist/union-member-surveys`

---

## 9. Deploy / migrations (fix P1001 on Mac)

Local `.env` often uses **DO Managed Postgres** (`:25060`). That host is **not reachable from your Mac** → `P1001 Can't reach database server`.

**Use droplet migrate (recommended):**

```bash
npm run migrate:droplet
# same as: npm run migrate:production:remote
```

Requires `.deploy.env` with `DEPLOY_HOST` and optional `DEPLOY_SSH_KEY`. Runs `prisma migrate deploy` on the server where `DATABASE_URL` is `localhost:5432`.

**Optional — tunnel from Mac** (if you must run Prisma locally):

```bash
./tunnel_db.sh   # keep open — forwards localhost:5433 → droplet :5432
DATABASE_URL='postgresql://USER:PASS@localhost:5433/kaburlutoday' npx prisma migrate deploy --schema prisma/schema.prisma
```

Migration: `20260524120000_survey_v2_general_review`
