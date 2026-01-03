import { Router } from 'express';
import passport from 'passport';
import { aiGenerateText } from '../../lib/aiProvider';
import { AI_PROVIDER, GEMINI_KEY, OPENAI_KEY, DEFAULT_GEMINI_MODEL_SEO, DEFAULT_OPENAI_MODEL_SEO, DEFAULT_OPENAI_MODEL_NEWSPAPER } from '../../lib/aiConfig';
import { getPrompt, renderPrompt } from '../../lib/prompts';

const router = Router();

/**
 * @swagger
 * /ai/test:
 *   get:
 *     summary: Test AI provider connectivity (Gemini/OpenAI)
 *     description: Calls the configured AI provider with a tiny prompt and returns a simple health result.
 *     tags: [AI]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Provider responded
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Successful ping
 *                 value:
 *                   ok: true
 *                   info:
 *                     provider: gemini
 *                     geminiKeyPresent: true
 *                     openaiKeyPresent: true
 *                     geminiModel: gemini-1.5-flash
 *                     openaiModel: gpt-4o-mini
 *                   textLength: 55
 *                   parsed:
 *                     ok: true
 *                     ts: "2025-12-03T09:20:11.123Z"
 *       500:
 *         description: Provider failed or not configured
 *         content:
 *           application/json:
 *             examples:
 *               noResponse:
 *                 summary: No response
 *                 value:
 *                   ok: false
 *                   info:
 *                     provider: gemini
 *                     geminiKeyPresent: false
 *                     openaiKeyPresent: true
 *                     geminiModel: gemini-1.5-flash
 *                     openaiModel: gpt-4o-mini
 *                   error: "No response from AI provider"
 */
router.get('/test', passport.authenticate('jwt', { session: false }), async (_req, res) => {
  try {
    const info = {
      provider: AI_PROVIDER,
      geminiKeyPresent: !!GEMINI_KEY,
      openaiKeyPresent: !!OPENAI_KEY,
      geminiModel: DEFAULT_GEMINI_MODEL_SEO,
      openaiModel: DEFAULT_OPENAI_MODEL_SEO
    };
    const pingPrompt = 'Return ONLY JSON: {"ok":true,"ts":"'+ new Date().toISOString() +'"}';
    const r = await aiGenerateText({ prompt: pingPrompt, purpose: 'seo' });
    const text = r.text || '';
    if (!text) return res.status(500).json({ ok: false, info, error: 'No response from AI provider' });
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch {}
    return res.json({ ok: true, info, textLength: text.length, parsed });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'AI test failed' });
  }
});

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Math.min(max, Math.max(min, i));
}

function stripCodeFences(text: string): string {
  const t = String(text || '');
  return t
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function parseHeadlineOutput(text: string, maxTitles: number): { titles: string[]; subtitle?: string | null } {
  const cleaned = stripCodeFences(text);
  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let subtitle: string | null = null;
  const titles: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^subtitle\s*:/i.test(line)) {
      const rest = line.replace(/^subtitle\s*:\s*/i, '').trim();
      subtitle = rest || (lines[i + 1] ? String(lines[i + 1]).trim() : null);
      continue;
    }
    const m = line.match(/^\d+\.?\s*(?:\)|\.)?\s*(.+)$/);
    if (m && m[1]) {
      const t = String(m[1]).replace(/^[-–—]\s*/, '').trim();
      if (!t) continue;
      if (t.length <= 60) titles.push(t);
      if (titles.length >= maxTitles) break;
    }
  }

  // Fallback: try to treat first non-empty line as a title
  if (!titles.length && lines.length) {
    const first = lines.find(l => !/^titles\s*:/i.test(l)) || '';
    const t = first.trim();
    if (t) titles.push(t.length <= 60 ? t : t.slice(0, 60).trim());
  }

  return { titles: titles.slice(0, maxTitles), subtitle };
}

/**
 * @swagger
 * /ai/headlines:
 *   post:
 *     summary: Generate short Telugu newspaper-style headline options
 *     description: Uses Prompt table key TELUGU_HEADLINE_EDITOR (fallback to default) and returns parsed title options (<=60 chars). Optionally returns a subtitle.
 *     tags: [AI]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string, description: 'Long title (optional if content provided)' }
 *               content: { type: string, description: 'Article content (optional if title provided)' }
 *               maxTitles: { type: number, minimum: 1, maximum: 5, default: 3 }
 *               includeSubtitle: { type: boolean, default: false }
 *           examples:
 *             sample:
 *               value:
 *                 title: "తెలంగాణలో భారీ వర్షాలు: నదులు పొంగి ప్రవహిస్తున్నాయి"
 *                 content: "హైదరాబాద్, వరంగల్ జిల్లాల్లో..."
 *                 maxTitles: 3
 *                 includeSubtitle: true
 *     responses:
 *       200:
 *         description: Generated headlines
 *       400:
 *         description: Bad input
 */
router.post('/headlines', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const title = req.body?.title ? String(req.body.title) : '';
    const content = req.body?.content ? String(req.body.content) : '';
    if (!title && !content) return res.status(400).json({ success: false, error: 'title or content is required' });

    const maxTitles = clampInt(req.body?.maxTitles, 1, 5, 3);
    const includeSubtitle = Boolean(req.body?.includeSubtitle);

    const tpl = await getPrompt('TELUGU_HEADLINE_EDITOR');
    let prompt = renderPrompt(tpl, { title, content });

    // Tighten runtime knobs without changing the stored prompt.
    prompt += `\n\nRuntime limits:\n- Generate MAXIMUM ${maxTitles} title options.`;
    if (includeSubtitle) {
      prompt += `\n\nAlso output after Titles list:\nSubtitle:\n<short Telugu subtitle (<= 80 chars)>\nDo not add extra labels/text beyond Titles list and Subtitle.`;
    }

    const result = await aiGenerateText({ prompt, purpose: 'newspaper' as any });
    const text = result.text || '';
    if (!text) {
      const info = {
        provider: AI_PROVIDER,
        geminiKeyPresent: !!GEMINI_KEY,
        openaiKeyPresent: !!OPENAI_KEY,
        geminiModel: DEFAULT_GEMINI_MODEL_SEO,
        openaiModel: DEFAULT_OPENAI_MODEL_SEO,
        openaiNewspaperModel: DEFAULT_OPENAI_MODEL_NEWSPAPER
      };
      return res.status(500).json({
        success: false,
        error: 'No response from AI provider',
        info,
        hint: 'Check OPENAI_API_KEY / GEMINI_API_KEY and model names (try OPENAI_MODEL_SEO=gpt-4o-mini).'
      });
    }

    const parsed = parseHeadlineOutput(text, maxTitles);
    return res.json({
      success: true,
      provider: AI_PROVIDER,
      promptKey: 'TELUGU_HEADLINE_EDITOR',
      titles: parsed.titles,
      subtitle: includeSubtitle ? (parsed.subtitle || null) : undefined,
      text,
      usage: result.usage
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Headline generation failed' });
  }
});
/**
 * @swagger
 * /ai/run:
 *   post:
 *     summary: Run AI with a stored prompt and article payload
 *     description: Provide a prompt key and minimal article payload; returns raw AI text and a best-effort parsed JSON.
 *     tags: [AI]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [promptKey, article]
 *             properties:
 *               promptKey: { type: string, example: 'ai_web_article_json' }
 *               provider: { type: string, enum: ['gemini','openai'], description: 'Optional override; defaults to env' }
 *               article:
 *                 type: object
 *                 properties:
 *                   tenantId: { type: string }
 *                   languageCode: { type: string, example: 'te' }
 *                   title: { type: string }
 *                   content: { type: string }
 *                   images: { type: array, items: { type: string } }
 *                   categoryIds: { type: array, items: { type: string } }
 *                   isPublished: { type: boolean }
 *           examples:
 *             sample:
 *               summary: Minimal request
 *               value:
 *                 promptKey: ai_web_article_json
 *                 provider: gemini
 *                 article:
 *                   tenantId: cmij2gk8u0001ht1elrfohkm5
 *                   languageCode: te
 *                   title: "తెలంగాణ బడ్జెట్ 2025"
 *                   content: "ప్రధాన అంశాలు..."
 *                   images: ["https://cdn/img1.jpg"]
 *                   categoryIds: ["cmij6h1nh000vgs1e0vnjw8o4"]
 *                   isPublished: true
 *     responses:
 *       200:
 *         description: AI response
 *         content:
 *           application/json:
 *             examples:
 *               parsedJson:
 *                 summary: Parsed JSON available
 *                 value:
 *                   ok: true
 *                   provider: gemini
 *                   promptKey: ai_web_article_json
 *                   textLength: 1342
 *                   text: "{ \"tenantId\": \"...\", \"languageCode\": \"te\", ... }"
 *                   parsed:
 *                     tenantId: "cmij2gk8u0001ht1elrfohkm5"
 *                     languageCode: "te"
 *                     slug: "telangana-budget-2025"
 *                     title: "తెలంగాణ బడ్జెట్ 2025"
 *                     status: "published"
 *                     publishedAt: "2025-12-03T15:25:11+05:30"
 *               nonJson:
 *                 summary: Non-JSON response
 *                 value:
 *                   ok: false
 *                   provider: gemini
 *                   promptKey: ai_web_article_json
 *                   textLength: 722
 *                   text: "Here is your article:\nTitle: ...\nContent: ...\n"
 *                   parsed: null
 *       400:
 *         description: Bad input
 */
router.post('/run', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { promptKey, provider, article } = req.body || {};
    if (!promptKey || !article || !article.title || !article.content) {
      return res.status(400).json({ error: 'promptKey, article.title, article.content are required' });
    }
    // Load prompt from DB or env fallback
    const prisma = require('../../lib/prisma').default;
    let tpl: string = '';
    try {
      const p = await prisma.prompt.findUnique({ where: { key: String(promptKey) } });
      tpl = (p?.content || '').trim();
    } catch {}
    // Do not fallback to env; prompts must live in DB only
    if (!tpl) return res.status(400).json({ error: `Prompt not found for key: ${promptKey}` });

    const vars = {
      TENANT_ID: String(article.tenantId || ''),
      LANGUAGE_CODE: String(article.languageCode || ''),
      AUTHOR_ID: String((req as any)?.user?.id || ''),
      CATEGORY_IDS: JSON.stringify(article.categoryIds || []),
      IMAGE_URLS: JSON.stringify(article.images || []),
      IS_PUBLISHED: String(!!article.isPublished),
      RAW_JSON: JSON.stringify({ title: article.title, content: article.content, images: article.images || [], categoryIds: article.categoryIds || [] }, null, 2)
    } as Record<string,string>;
    const prompt = Object.keys(vars).reduce((acc, k) => acc.split(`{{${k}}}`).join(vars[k]).split(`{${k}}`).join(vars[k]), tpl);

    // Select provider override or env default
    const useProvider = (provider && (provider === 'gemini' || provider === 'openai')) ? provider : AI_PROVIDER;
    // Temporarily override selection by env keys presence
    const ai = require('../../lib/aiProvider');
    const result = await ai.aiGenerateText({ prompt, purpose: 'rewrite' });
    const text = result.text || '';
    let parsed: any = null;
    if (text) {
      // Try JSON parse window
      const trimmed = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      try { parsed = JSON.parse(trimmed); } catch {
        const first = trimmed.indexOf('{'); const last = trimmed.lastIndexOf('}');
        if (first !== -1 && last > first) {
          try { parsed = JSON.parse(trimmed.slice(first, last + 1)); } catch {}
        }
      }
    }
    return res.json({ ok: !!text, provider: useProvider, promptKey, textLength: text.length, text, parsed, usage: result.usage });
  } catch (e) {
    return res.status(500).json({ error: 'AI run failed' });
  }
});

export default router;