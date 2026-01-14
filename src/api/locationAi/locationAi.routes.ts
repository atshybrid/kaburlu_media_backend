import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireReporterOrAdmin } from '../middlewares/authz';
import { aiGenerateText } from '../../lib/aiProvider';
import { OPENAI_KEY } from '../../lib/aiConfig';

const router = Router();

const SUPPORTED_LANGS = ['hi', 'en', 'te', 'bn', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'pa', 'or', 'as'] as const;

type SupportedLang = (typeof SUPPORTED_LANGS)[number];

type TranslationItem = {
  id: string;
  name: Record<SupportedLang, string>;
};

const MASTER_SYSTEM_PROMPT = `You are a government-data language formatter.

Rules:
- DO NOT invent new states, districts, mandals, or villages.
- Only translate and format the names provided in input.
- Keep official spelling.
- Output must be valid JSON only.
- Use these languages exactly: hi, en, te, bn, mr, ta, ur, gu, kn, ml, pa, or, as
- If translation is uncertain, keep English value.
- Maintain hierarchy exactly as input.`;

function stripCodeFences(text: string): string {
  const t = String(text || '');
  return t
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function tryParseJson(text: string): any | null {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // try slice largest json
  }
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      // ignore
    }
  }
  const s2 = cleaned.indexOf('{');
  const e2 = cleaned.lastIndexOf('}');
  if (s2 >= 0 && e2 > s2) {
    try {
      return JSON.parse(cleaned.slice(s2, e2 + 1));
    } catch {
      // ignore
    }
  }
  return null;
}

// Import new populate routes
import locationPopulateRoutes from './locationPopulate.routes';

async function openaiChatJson(messages: Array<{ role: 'system' | 'user'; content: string }>, model: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const axios = require('axios');
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_KEY');

  // Increased timeout for translation requests (2 minutes)
  const timeoutMs = Number(process.env.AI_TRANSLATE_TIMEOUT_MS || process.env.AI_TIMEOUT_MS || 120_000);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        signal: ctrl.signal,
      }
    );
    const content = resp?.data?.choices?.[0]?.message?.content || '';
    return { content, raw: resp?.data };
  } catch (e: any) {
    // Fallback without strict json mode (or model issues)
    const axiosErr = e;
    const status = axiosErr?.response?.status;
    const errMsg = axiosErr?.response?.data?.error?.message || axiosErr?.message || '';
    const looksLikeFormatIssue = status === 400 && /response_format/i.test(String(errMsg));
    const looksLikeModelIssue = status === 400 && /model/i.test(String(errMsg));
    if (!looksLikeFormatIssue && !looksLikeModelIssue) throw e;

    const fallbackModel = model || 'gpt-4o-mini';
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: fallbackModel,
        messages,
        temperature: 0,
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        signal: ctrl.signal,
      }
    );
    const content = resp?.data?.choices?.[0]?.message?.content || '';
    return { content, raw: resp?.data };
  } finally {
    clearTimeout(t);
  }
}

function validateTranslationArray(obj: any): TranslationItem[] {
  // We accept either a top-level array OR { items: [] }
  const arr = Array.isArray(obj) ? obj : (Array.isArray(obj?.items) ? obj.items : null);
  if (!Array.isArray(arr)) throw new Error('AI returned invalid JSON shape (expected array or {items:[]})');

  const out: TranslationItem[] = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const id = String((it as any).id || '').trim();
    const name = (it as any).name;
    if (!id || !name || typeof name !== 'object') continue;

    const fixed: any = {};
    for (const lc of SUPPORTED_LANGS) {
      const v = String((name as any)[lc] ?? '').trim();
      fixed[lc] = v;
    }
    out.push({ id, name: fixed });
  }
  if (!out.length) throw new Error('AI returned empty translation list');
  return out;
}

async function translateBatch(opts: {
  entityLabel: 'states' | 'districts' | 'mandals' | 'villages';
  items: Array<{ id: string; en: string }>;
  model?: string;
}) {
  const payload = {
    entity: opts.entityLabel,
    languages: SUPPORTED_LANGS,
    items: opts.items.map((x) => ({ id: x.id, en: x.en })),
  };

  const userPrompt = `Translate the provided ${opts.entityLabel} names into all supported languages.

Input JSON contains: { entity, languages, items:[{id,en}] }.

Return ONLY valid JSON with EXACT shape:
{
  "items": [
    { "id": "...", "name": { "en": "...", "hi": "...", "te": "...", "bn": "...", "mr": "...", "ta": "...", "ur": "...", "gu": "...", "kn": "...", "ml": "...", "pa": "...", "or": "...", "as": "..." } }
  ]
}

Rules:
- Keep the same id values.
- Do NOT change the English spelling; set name.en exactly equal to input en.
- If unsure about a language, copy the English value for that language.
- Output JSON only.`;

  let aiText = '';
  let provider: 'openai' | 'gemini' = 'gemini';

  if (OPENAI_KEY) {
    provider = 'openai';
    const model = String(opts.model || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
    const r = await openaiChatJson(
      [
        { role: 'system', content: MASTER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      model
    );
    aiText = String(r?.content || '');
  } else {
    const combined = `${MASTER_SYSTEM_PROMPT}\n\n${userPrompt}\n\nINPUT_JSON:\n${JSON.stringify(payload)}\n\nReturn JSON only.`;
    const r = await aiGenerateText({ prompt: combined, purpose: 'translation' as any });
    aiText = String(r?.text || '');
  }

  if (!aiText.trim()) throw new Error(`AI returned empty response (${provider})`);
  const parsed = tryParseJson(aiText);
  if (!parsed) throw new Error(`AI returned invalid JSON (${provider})`);

  const items = validateTranslationArray(parsed);

  // Force name.en to match input (never allow AI to change English)
  const byId = new Map(opts.items.map((x) => [x.id, x.en] as const));
  return items.map((it) => {
    const en = byId.get(it.id);
    if (en) it.name.en = en;
    // Ensure all language keys exist
    for (const lc of SUPPORTED_LANGS) {
      if (!it.name[lc]) it.name[lc] = it.name.en;
    }
    return it;
  });
}

async function translateInChunks(opts: {
  entityLabel: 'states' | 'districts' | 'mandals' | 'villages';
  items: Array<{ id: string; en: string }>;
  chunkSize: number;
  model?: string;
}) {
  const out: TranslationItem[] = [];
  for (let i = 0; i < opts.items.length; i += opts.chunkSize) {
    const chunk = opts.items.slice(i, i + opts.chunkSize);
    const translated = await translateBatch({ entityLabel: opts.entityLabel, items: chunk, model: opts.model });
    out.push(...translated);
  }
  return out;
}

/**
 * @swagger
 * tags:
 *   - name: Location AI
 *     description: AI helper endpoints for location translations (DB is source-of-truth)
 */

/**
 * @swagger
 * /location/states:
 *   post:
 *     summary: Get India states translated into 13 languages (AI)
 *     tags: [Location AI]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit: { type: integer, minimum: 1, maximum: 100, default: 50 }
 *               offset: { type: integer, minimum: 0, default: 0 }
 *               model: { type: string, example: "gpt-4o-mini" }
 *     responses:
 *       200:
 *         description: Translated state list
 */
router.post('/states', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.body?.limit || 50), 100));
    const offset = Math.max(0, Number(req.body?.offset || 0));
    const model = req.body?.model ? String(req.body.model) : undefined;

    const total = await prisma.state.count({ where: { isDeleted: false } });
    const states = await prisma.state.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    });

    const items = states.map((s) => ({ id: s.id, en: s.name }));
    const translated = await translateInChunks({ entityLabel: 'states', items, chunkSize: 50, model });
    const nextOffset = offset + states.length;
    return res.json({
      meta: { total, limit, offset, nextOffset: nextOffset < total ? nextOffset : null },
      count: translated.length,
      items: translated,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to translate states', message: e?.message || String(e) });
  }
});

/**
 * @swagger
 * /location/districts:
 *   post:
 *     summary: Get districts for a state translated into 13 languages (AI)
 *     tags: [Location AI]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stateId]
 *             properties:
 *               stateId: { type: string }
 *               limit: { type: integer, minimum: 1, maximum: 200, default: 100 }
 *               offset: { type: integer, minimum: 0, default: 0 }
 *               model: { type: string, example: "gpt-4o-mini" }
 *     responses:
 *       200:
 *         description: Translated district list
 */
router.post('/districts', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, async (req, res) => {
  try {
    const stateId = String(req.body?.stateId || '').trim();
    if (!stateId) return res.status(400).json({ error: 'stateId is required' });

    const limit = Math.max(1, Math.min(Number(req.body?.limit || 100), 200));
    const offset = Math.max(0, Number(req.body?.offset || 0));
    const model = req.body?.model ? String(req.body.model) : undefined;

    const total = await prisma.district.count({ where: { isDeleted: false, stateId } });
    const districts = await prisma.district.findMany({
      where: { isDeleted: false, stateId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    });

    const items = districts.map((d) => ({ id: d.id, en: d.name }));
    // Reduced chunk size from 80 to 30 for faster per-request processing
    const translated = await translateInChunks({ entityLabel: 'districts', items, chunkSize: 30, model });
    const nextOffset = offset + districts.length;
    return res.json({
      stateId,
      meta: { total, limit, offset, nextOffset: nextOffset < total ? nextOffset : null },
      count: translated.length,
      items: translated,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to translate districts', message: e?.message || String(e) });
  }
});

/**
 * @swagger
 * /location/mandals:
 *   post:
 *     summary: Get mandals for a district translated into 13 languages (AI)
 *     tags: [Location AI]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [districtId]
 *             properties:
 *               districtId: { type: string }
 *               limit: { type: integer, minimum: 1, maximum: 300, default: 150 }
 *               offset: { type: integer, minimum: 0, default: 0 }
 *               model: { type: string, example: "gpt-4o-mini" }
 *     responses:
 *       200:
 *         description: Translated mandal list
 */
router.post('/mandals', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, async (req, res) => {
  try {
    const districtId = String(req.body?.districtId || '').trim();
    if (!districtId) return res.status(400).json({ error: 'districtId is required' });

    const limit = Math.max(1, Math.min(Number(req.body?.limit || 150), 300));
    const offset = Math.max(0, Number(req.body?.offset || 0));
    const model = req.body?.model ? String(req.body.model) : undefined;

    const total = await prisma.mandal.count({ where: { isDeleted: false, districtId } });
    const mandals = await prisma.mandal.findMany({
      where: { isDeleted: false, districtId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    });

    const items = mandals.map((m) => ({ id: m.id, en: m.name }));
    const translated = await translateInChunks({ entityLabel: 'mandals', items, chunkSize: 80, model });
    const nextOffset = offset + mandals.length;
    return res.json({
      districtId,
      meta: { total, limit, offset, nextOffset: nextOffset < total ? nextOffset : null },
      count: translated.length,
      items: translated,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to translate mandals', message: e?.message || String(e) });
  }
});

/**
 * @swagger
 * /location/villages:
 *   post:
 *     summary: Get villages for a mandal translated into 13 languages (AI)
 *     description: Villages are tenant-scoped; provide tenantId if you want to restrict.
 *     tags: [Location AI]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mandalId]
 *             properties:
 *               mandalId: { type: string }
 *               tenantId: { type: string }
 *               limit: { type: integer, minimum: 1, maximum: 500, default: 200 }
 *               offset: { type: integer, minimum: 0, default: 0 }
 *               model: { type: string, example: "gpt-4o-mini" }
 *     responses:
 *       200:
 *         description: Translated village list
 */
router.post('/villages', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, async (req, res) => {
  try {
    const mandalId = String(req.body?.mandalId || '').trim();
    if (!mandalId) return res.status(400).json({ error: 'mandalId is required' });

    const tenantId = req.body?.tenantId ? String(req.body.tenantId) : undefined;
    const limit = Math.max(1, Math.min(Number(req.body?.limit || 200), 500));
    const offset = Math.max(0, Number(req.body?.offset || 0));
    const model = req.body?.model ? String(req.body.model) : undefined;

    const where: any = { isDeleted: false, mandalId };
    if (tenantId) where.tenantId = tenantId;

    const total = await (prisma as any).village.count({ where });
    const villages = await (prisma as any).village.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    });

    const items = (villages as any[]).map((v) => ({ id: String(v.id), en: String(v.name) }));
    const translated = await translateInChunks({ entityLabel: 'villages', items, chunkSize: 80, model });
    const nextOffset = offset + (villages as any[]).length;
    return res.json({
      mandalId,
      tenantId: tenantId || null,
      meta: { total, limit, offset, nextOffset: nextOffset < total ? nextOffset : null },
      count: translated.length,
      items: translated,
    });
  } catch (e: any) {
    return res.status(500).json({ error: 'Failed to translate villages', message: e?.message || String(e) });
  }
});

// Mount new populate routes
router.use('/ai', locationPopulateRoutes);

export default router;
