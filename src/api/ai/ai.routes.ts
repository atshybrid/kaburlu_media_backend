import { Router } from 'express';
import passport from 'passport';
import { aiGenerateText } from '../../lib/aiProvider';
import { AI_PROVIDER, GEMINI_KEY, OPENAI_KEY, DEFAULT_GEMINI_MODEL_SEO, DEFAULT_OPENAI_MODEL_SEO } from '../../lib/aiConfig';

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

export default router;
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