#!/usr/bin/env node
/*
  ID Card API smoke tests (safe-by-default)

  Usage:
    node scripts/id_card_api_smoke.mjs

  Env:
    BASE_URL           default: http://localhost:3001
    TENANT_ID          required for tenant-scoped tests
    REPORTER_ID        required
    TENANT_TOKEN       optional (Bearer token). Needed for issue/regenerate/resend/delete
    REPORTER_TOKEN     optional (Bearer token). Needed for /reporters/me/* tests

  Safety toggles:
    RUN_MUTATIONS      default: 0  (set 1 to call issue/regenerate/delete)
    RUN_WHATSAPP       default: 0  (set 1 to call resend endpoints)

  Notes:
    - Resend/regenerate endpoints may trigger WhatsApp messages if configured.
    - Public download endpoint is always safe: GET /api/v1/id-cards/pdf
*/

import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const TENANT_ID = (process.env.TENANT_ID || '').trim();
const REPORTER_ID = (process.env.REPORTER_ID || '').trim();
const TENANT_TOKEN = (process.env.TENANT_TOKEN || '').trim();
const REPORTER_TOKEN = (process.env.REPORTER_TOKEN || '').trim();

const RUN_MUTATIONS = String(process.env.RUN_MUTATIONS || '0') === '1';
const RUN_WHATSAPP = String(process.env.RUN_WHATSAPP || '0') === '1';

if (!REPORTER_ID) {
  console.error('Missing REPORTER_ID env');
  process.exit(2);
}

function urlJoin(base, p) {
  return `${base}${p.startsWith('/') ? '' : '/'}${p}`;
}

async function httpJson(method, url, { token, body } = {}) {
  const headers = {
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _nonJsonBody: text };
  }
  return { status: res.status, ok: res.ok, json };
}

async function httpPdf(url, outFile) {
  const res = await fetch(url, { method: 'GET' });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outFile, buf);
  const isPdf = buf.slice(0, 4).toString('utf8') === '%PDF';

  let bodyPreview = null;
  if (!isPdf) {
    const asText = buf.toString('utf8');
    bodyPreview = asText.slice(0, 500);
  }

  return { status: res.status, ok: res.ok, bytes: buf.length, isPdf, bodyPreview };
}

function step(title) {
  process.stdout.write(`\n=== ${title} ===\n`);
}

function assertOk(label, result) {
  if (!result.ok) {
    console.error(`${label} FAILED`, result);
    process.exitCode = 1;
  } else {
    console.log(`${label} OK`);
  }
}

(async () => {
  console.log('Config', {
    BASE_URL,
    TENANT_ID: TENANT_ID || null,
    REPORTER_ID,
    RUN_MUTATIONS,
    RUN_WHATSAPP,
    hasTenantToken: !!TENANT_TOKEN,
    hasReporterToken: !!REPORTER_TOKEN,
  });

  const tmpDir = '/tmp';
  const pdfForce = path.join(tmpDir, `idcard_${REPORTER_ID}_forceRender.pdf`);
  const pdfStored = path.join(tmpDir, `idcard_${REPORTER_ID}_storedOrRender.pdf`);

  step('Public download (forceRender=true)');
  {
    const url = urlJoin(BASE_URL, `/api/v1/id-cards/pdf?reporterId=${encodeURIComponent(REPORTER_ID)}&forceRender=true`);
    const r = await httpPdf(url, pdfForce);
    console.log({ url, ...r, file: pdfForce });
    assertOk('public pdf forceRender', r);
    if (!r.isPdf) {
      console.error('Downloaded file is not a PDF');
      process.exitCode = 1;
    }
  }

  step('Public download (prefer stored pdfUrl)');
  {
    const url = urlJoin(BASE_URL, `/api/v1/id-cards/pdf?reporterId=${encodeURIComponent(REPORTER_ID)}`);
    const r = await httpPdf(url, pdfStored);
    console.log({ url, ...r, file: pdfStored });
    assertOk('public pdf stored', r);
    if (!r.isPdf) {
      console.error('Downloaded file is not a PDF');
      process.exitCode = 1;
    }
  }

  if (TENANT_ID) {
    step('Tenant: get reporter id-card (no auth)');
    {
      const url = urlJoin(BASE_URL, `/api/v1/tenants/${encodeURIComponent(TENANT_ID)}/reporters/${encodeURIComponent(REPORTER_ID)}/id-card`);
      const r = await httpJson('GET', url);
      console.log({ url, status: r.status, cardNumber: r.json?.cardNumber ?? null, pdfUrl: r.json?.pdfUrl ?? null });
      assertOk('tenant get id-card', r);
    }

    if (TENANT_TOKEN && RUN_MUTATIONS) {
      step('Tenant: issue/generate id-card');
      {
        const url = urlJoin(BASE_URL, `/api/v1/tenants/${encodeURIComponent(TENANT_ID)}/reporters/${encodeURIComponent(REPORTER_ID)}/id-card`);
        const r = await httpJson('POST', url, { token: TENANT_TOKEN });
        console.log({ url, status: r.status, cardNumber: r.json?.cardNumber ?? null, pdfUrl: r.json?.pdfUrl ?? null });
        assertOk('tenant issue id-card', r);
      }

      step('Tenant: regenerate id-card (keepCardNumber=true)');
      {
        const url = urlJoin(
          BASE_URL,
          `/api/v1/tenants/${encodeURIComponent(TENANT_ID)}/reporters/${encodeURIComponent(REPORTER_ID)}/id-card/regenerate`
        );
        const r = await httpJson('POST', url, {
          token: TENANT_TOKEN,
          body: { keepCardNumber: true, reason: 'smoke-test' },
        });
        console.log({ url, status: r.status, cardNumber: r.json?.cardNumber ?? null, pdfUrl: r.json?.pdfUrl ?? null });
        assertOk('tenant regenerate id-card', r);
      }

      step('Tenant: clear pdfUrl (force fresh PDF next time)');
      {
        const url = urlJoin(
          BASE_URL,
          `/api/v1/tenants/${encodeURIComponent(TENANT_ID)}/reporters/${encodeURIComponent(REPORTER_ID)}/id-card/pdf`
        );
        const r = await httpJson('DELETE', url, { token: TENANT_TOKEN });
        console.log({ url, status: r.status, body: r.json });
        assertOk('tenant delete id-card pdfUrl', r);
      }
    }

    if (TENANT_TOKEN && RUN_WHATSAPP) {
      step('Tenant: resend id-card via WhatsApp');
      {
        const url = urlJoin(
          BASE_URL,
          `/api/v1/tenants/${encodeURIComponent(TENANT_ID)}/reporters/${encodeURIComponent(REPORTER_ID)}/id-card/resend`
        );
        const r = await httpJson('POST', url, { token: TENANT_TOKEN });
        console.log({ url, status: r.status, body: r.json });
        assertOk('tenant resend id-card', r);
      }
    }
  }

  if (REPORTER_TOKEN && RUN_MUTATIONS) {
    step('Reporter: /reporters/me/id-card (generate)');
    {
      const url = urlJoin(BASE_URL, '/api/v1/reporters/me/id-card');
      const r = await httpJson('POST', url, { token: REPORTER_TOKEN });
      console.log({ url, status: r.status, cardNumber: r.json?.cardNumber ?? null, pdfUrl: r.json?.pdfUrl ?? null });
      assertOk('me generate id-card', r);
    }

    step('Reporter: /reporters/me/id-card/regenerate');
    {
      const url = urlJoin(BASE_URL, '/api/v1/reporters/me/id-card/regenerate');
      const r = await httpJson('POST', url, { token: REPORTER_TOKEN, body: { keepCardNumber: true } });
      console.log({ url, status: r.status, cardNumber: r.json?.cardNumber ?? null, pdfUrl: r.json?.pdfUrl ?? null });
      assertOk('me regenerate id-card', r);
    }
  }

  if (REPORTER_TOKEN && RUN_WHATSAPP) {
    step('Reporter: /reporters/me/id-card/resend (WhatsApp)');
    {
      const url = urlJoin(BASE_URL, '/api/v1/reporters/me/id-card/resend');
      const r = await httpJson('POST', url, { token: REPORTER_TOKEN });
      console.log({ url, status: r.status, body: r.json });
      assertOk('me resend id-card', r);
    }
  }

  if (!process.exitCode) {
    console.log('\nAll enabled smoke tests passed.');
  } else {
    console.log('\nSome tests failed (see logs above).');
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
