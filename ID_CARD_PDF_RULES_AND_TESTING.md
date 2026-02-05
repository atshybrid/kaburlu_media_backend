# ID Card PDF – Rules + Testing (Backend)

## Which PDF is the “final / locked” design?
- The **final ID card PDF design is the locked Puppeteer HTML→PDF template** implemented in the ID-card PDF generator.
- The **public download endpoint** also uses the **same locked Puppeteer template** when it needs to render.

## PDF selection / precedence rules (what the API serves)
### 1) Stored `pdfUrl` (Bunny CDN) is preferred
- Endpoint: `GET /api/v1/id-cards/pdf?reporterId=...`
- Behavior:
  - If the reporter’s ID-card DB row has a non-empty `pdfUrl` **and you did NOT pass** `forceRender=true`, the API **fetches that URL** and streams it as the download.
  - This guarantees **the same file** as WhatsApp uses (no layout mismatch).

### 2) Force render always regenerates
- Endpoint: `GET /api/v1/id-cards/pdf?reporterId=...&forceRender=true`
- Behavior:
  - Skips the stored `pdfUrl` fetch.
  - Generates PDF on-the-fly using the locked Puppeteer template.

### 3) Tenant issue/regenerate/resend pdfUrl rules
- `POST /api/v1/tenants/:tenantId/reporters/:id/id-card`
  - Creates the ID-card record.
  - If Bunny is configured, it tries to generate/upload and persist Bunny `pdfUrl`.
  - If Bunny is NOT configured (typical local/dev), it persists a **fallback URL**:
    - `/api/v1/id-cards/pdf?reporterId=...&forceRender=true`
- `POST /api/v1/tenants/:tenantId/reporters/:id/id-card/regenerate`
  - Deletes and re-creates the ID card.
  - If Bunny is configured, generates/uploads first and persists Bunny `pdfUrl`.
  - Otherwise persists the fallback URL.
- `POST /api/v1/tenants/:tenantId/reporters/:id/id-card/resend`
  - If `pdfUrl` missing, it auto-regenerates (Bunny if available; fallback otherwise), then sends WhatsApp.

## Cache / “PDFKit design showing” root cause (what changed)
- Bunny CDN can cache by URL. If you overwrite the **same object key** (same URL), the CDN may keep serving the old cached file.
- Fix: Bunny upload keys are generated **unique per generation**, so every regenerate/issue produces a **new URL** and the CDN cannot serve an older cached PDF for that new URL.

## “Which card did we generate in the latest local smoke test?”
- We ran the generator directly (not via HTTP) using the locked Puppeteer generator:
  - Function: `generateAndUploadIdCardPdf(reporterId)`
- Reporter used:
  - `reporterId`: `cml8i1z6o01f2jy23tv0exks5`
  - Existing `cardNumber` in DB: `KT202602012`
- Output URL (unique):
  - `https://kaburlu-news.b-cdn.net/id-cards/cml8i1z6o01f2jy23tv0exks5_KT202602012_<unique>.pdf`

## Best-practice API smoke testing
### Safe-by-default script
- Script: `scripts/id_card_api_smoke.mjs`
- Default behavior:
  - Only calls the **public PDF download** endpoints.
  - Does **not** call mutation endpoints (issue/regenerate/delete) unless enabled.
  - Does **not** call WhatsApp resend endpoints unless enabled.

### Run examples
- Public download-only test (safe):
  - `BASE_URL=http://localhost:3001 REPORTER_ID=<id> node scripts/id_card_api_smoke.mjs`

- Tenant full test (mutations) without WhatsApp:
  - `BASE_URL=http://localhost:3001 TENANT_ID=<tenantId> REPORTER_ID=<id> TENANT_TOKEN=<jwt> RUN_MUTATIONS=1 node scripts/id_card_api_smoke.mjs`

- Enable resend tests (may send WhatsApp):
  - Add `RUN_WHATSAPP=1`

## “Delete all id-card pdf links” (recommended approach)
- Recommended: **clear DB `pdfUrl` only**, not physical deletes.
  - Endpoint: `DELETE /api/v1/tenants/:tenantId/reporters/:id/id-card/pdf`
  - Next resend/regenerate will create a fresh link.
- Physical deletion in Bunny is possible but not implemented as a bulk-safe operation here (and requires carefully deriving object keys).
