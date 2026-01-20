import { Router, Request, Response } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireReporterOrAdmin } from '../middlewares/authz';
import { aiGenerateText } from '../../lib/aiProvider';
import { OPENAI_KEY } from '../../lib/aiConfig';
import { DEFAULT_PROMPTS } from '../../lib/defaultPrompts';

const DEFAULT_OPENAI_MODEL = String(process.env.OPENAI_MODEL_REWRITE || 'gpt-4.1-mini');

const router = Router();

function stripCodeFences(text: string): string {
  const t = String(text || '');
  return t
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function tryParseJsonObject(text: string): any | null {
  const cleaned = stripCodeFences(text);
  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === 'object') return direct;
  } catch {
    // ignore
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = cleaned.slice(start, end + 1);
    try {
      const obj = JSON.parse(sliced);
      if (obj && typeof obj === 'object') return obj;
    } catch {
      // ignore
    }
  }

  return null;
}

async function openaiChatMessages(messages: Array<{ role: 'system' | 'user'; content: string }>, model: string, temperature = 0.2) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const axios = require('axios');
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_KEY');

  const ctrl = new AbortController();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 60_000);
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const call = async (m: string) => {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: m,
        messages,
        temperature,
        response_format: { type: 'json_object' },
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        signal: ctrl.signal,
      }
    );

    const content = resp?.data?.choices?.[0]?.message?.content || '';
    return { content, raw: resp?.data };
  };

  try {
    try {
      return await call(model);
    } catch (e: any) {
      const status = e?.response?.status;
      const errMsg = e?.response?.data?.error?.message || e?.message || '';
      const looksLikeModelOrFormatIssue = status === 400 && /(model|response_format)/i.test(String(errMsg));
      if (!looksLikeModelOrFormatIssue) throw e;

      // Retry with fallback model
      const fallbackModel = DEFAULT_OPENAI_MODEL || 'gpt-4.1-mini';
      const resp = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: fallbackModel,
          messages,
          temperature,
        },
        {
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
          signal: ctrl.signal,
        }
      );
      const content = resp?.data?.choices?.[0]?.message?.content || '';
      return { content, raw: resp?.data };
    }
  } finally {
    clearTimeout(t);
  }
}

/**
 * @swagger
 * /ai/rewrite/unified:
 *   post:
 *     summary: Newsroom AI Agent - Unified Article Rewrite
 *     description: |
 *       **THE ONLY AI REWRITE ENDPOINT YOU NEED**
 *       
 *       Industrial-grade newsroom AI agent that generates THREE article formats from raw reporter input:
 *       1. **print_article** - For newspaper/ePaper PDF generation
 *       2. **web_article** - SEO-optimized for website CMS
 *       3. **short_mobile_article** - For mobile app (≤60 words)
 *       
 *       Also returns:
 *       - **images** - Image requirements and captions
 *       - **internal_evidence** - What reporter must submit before publishing
 *       - **status** - Publish readiness and validation issues
 *       
 *       **BEST PRACTICE FLOW:**
 *       1. Call this endpoint with raw reporter text
 *       2. Show print_article to reporter for review/edit
 *       3. POST /api/v1/articles with all data to create all 3 articles
 *       
 *       Uses prompt key: `newsroom_ai_agent`
 *     tags: [News Room]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: debug
 *         required: false
 *         schema:
 *           type: boolean
 *         description: When true, includes prompt and provider info in response.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rawText, categories]
 *             properties:
 *               rawText:
 *                 type: string
 *                 description: Raw reporter post text
 *                 example: "నగరంలో శుక్రవారం రాత్రి జరిగిన రోడ్డు ప్రమాదంలో ఇద్దరు గాయపడ్డారు..."
 *               categories:
 *                 type: array
 *                 description: Your database category names. AI will pick ONE matching category.
 *                 items:
 *                   type: string
 *                 example: ["Crime", "Accident", "Politics", "Sports", "Health", "Education"]
 *               newspaperName:
 *                 type: string
 *                 description: Name of the newspaper
 *                 example: "Daily News"
 *               language:
 *                 type: object
 *                 description: Language configuration
 *                 properties:
 *                   code:
 *                     type: string
 *                     example: "te"
 *                   name:
 *                     type: string
 *                     example: "Telugu"
 *                   script:
 *                     type: string
 *                     example: "Telugu"
 *                   region:
 *                     type: string
 *                     example: "Telangana"
 *               temperature:
 *                 type: number
 *                 default: 0.2
 *                 description: AI temperature (0-1, lower = more factual)
 *               model:
 *                 type: string
 *                 description: Optional OpenAI model override
 *     responses:
 *       200:
 *         description: Newsroom AI output with all article formats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 detected_category:
 *                   type: string
 *                   description: AI-detected category name from raw text
 *                   example: "Accident"
 *                 selected_category:
 *                   type: object
 *                   description: Matched category from your input list
 *                   properties:
 *                     name:
 *                       type: string
 *                       description: Matched category name - use this to find ID in your database
 *                       example: "Accident"
 *                     ai_detected:
 *                       type: string
 *                       description: What AI originally detected from raw text
 *                       example: "Accident"
 *                     match_type:
 *                       type: string
 *                       description: How the match was made
 *                       enum: [exact, fuzzy, fallback]
 *                       example: "exact"
 *                 print_article:
 *                   type: object
 *                   properties:
 *                     news_type: { type: string }
 *                     headline: { type: string }
 *                     subtitle: { type: string, nullable: true }
 *                     dateline: { type: object }
 *                     body: { type: array, items: { type: string } }
 *                     highlights: { type: array, nullable: true }
 *                     fact_box: { type: object, nullable: true }
 *                     editor_note: { type: string }
 *                 web_article:
 *                   type: object
 *                   properties:
 *                     headline: { type: string }
 *                     dateline: { type: string }
 *                     lead: { type: string }
 *                     body: { type: array, items: { type: string } }
 *                     seo:
 *                       type: object
 *                       properties:
 *                         url_slug: { type: string }
 *                         meta_title: { type: string }
 *                         meta_description: { type: string }
 *                         keywords: { type: array, items: { type: string } }
 *                 short_mobile_article:
 *                   type: object
 *                   properties:
 *                     h1: { type: string }
 *                     h2: { type: string, nullable: true }
 *                     body: { type: string }
 *                 images:
 *                   type: object
 *                 internal_evidence:
 *                   type: object
 *                 status:
 *                   type: object
 *                   properties:
 *                     publish_ready: { type: boolean }
 *                     validation_issues: { type: array }
 *                     approval_status: { type: string }
 *       400:
 *         description: Bad input or missing prompt
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: AI failure
 */
router.post(
  '/rewrite/unified',
  passport.authenticate('jwt', { session: false }),
  requireReporterOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const rawText = String(req.body?.rawText ?? req.body?.raw ?? req.body?.text ?? req.body?.content ?? '').trim();
      const newspaperName = String(req.body?.newspaperName ?? '').trim() || 'News';
      const language = req.body?.language || { code: 'te', name: 'Telugu', script: 'Telugu', region: 'India' };
      const temperature = Number(req.body?.temperature ?? 0.2);
      
      if (!rawText) {
        return res.status(400).json({ error: 'rawText is required' });
      }

      // Categories: Accept from request OR auto-fetch from database
      // Format: ["Crime", "Accident", "Politics", ...] - just names, not IDs
      const categoriesInput = req.body?.categories;
      let categoryNames: string[] = [];
      
      if (Array.isArray(categoriesInput) && categoriesInput.length > 0) {
        // User passed category names - use them directly
        categoryNames = categoriesInput
          .map((c: any) => {
            if (typeof c === 'string') return c.trim();
            if (c && typeof c === 'object' && c.name) return String(c.name).trim();
            return '';
          })
          .filter(Boolean);
      }
      
      // If no categories passed, auto-fetch from database (fallback)
      if (categoryNames.length === 0) {
        const user: any = (req as any).user;
        let tenantId: string | null = null;
        
        if (user?.role?.name === 'SUPER_ADMIN') {
          tenantId = req.body?.tenantId ? String(req.body.tenantId).trim() : null;
        } else {
          const reporter = await (prisma as any).reporter.findFirst({
            where: { userId: user.id },
            select: { tenantId: true }
          }).catch(() => null);
          tenantId = reporter?.tenantId || null;
        }

        if (tenantId) {
          const domainCategories = await (prisma as any).domainStateCategory.findMany({
            where: { domain: { tenantId }, isEnabled: true },
            select: { category: { select: { name: true } } }
          }).catch(() => []);
          
          if (domainCategories.length > 0) {
            categoryNames = domainCategories
              .filter((dc: any) => dc.category?.name)
              .map((dc: any) => dc.category.name);
          }
        }
        
        if (categoryNames.length === 0) {
          const globalCategories = await prisma.category.findMany({
            where: { isDeleted: false },
            select: { name: true },
            orderBy: { name: 'asc' }
          }).catch(() => []);
          categoryNames = globalCategories.map((c: any) => c.name);
        }
      }
      
      if (categoryNames.length === 0) {
        return res.status(400).json({ 
          error: 'No categories found',
          details: 'Pass categories array OR ensure categories exist in database'
        });
      }

      const debug = String((req.query as any)?.debug || '').toLowerCase() === 'true';

      const promptKey = 'newsroom_ai_agent';
      
      // Load prompt from DB first, fallback to default
      const dbPrompt = await (prisma as any).prompt.findUnique({ where: { key: promptKey } }).catch(() => null);
      let systemPrompt = String(dbPrompt?.content || '').trim();
      
      // Fallback to default if not in DB or deprecated
      if (!systemPrompt || systemPrompt.startsWith('DEPRECATED')) {
        const defaultPrompt = DEFAULT_PROMPTS.find(dp => dp.key === promptKey);
        systemPrompt = defaultPrompt?.content || '';
      }
      
      if (!systemPrompt) {
        return res.status(400).json({ error: `Prompt not found for key: ${promptKey}` });
      }

      // Build categories list for AI to pick from
      const categoriesListStr = categoryNames.join(', ');

      // Build user message with structured input
      // AI will pick ONE category from the provided list
      const userMessage = `
RAW_NEWS_TEXT:
${rawText}

AVAILABLE_CATEGORIES (pick EXACTLY ONE from this list):
${categoriesListStr}

NEWSPAPER_NAME: ${newspaperName}

LANGUAGE:
${JSON.stringify(language, null, 2)}
`.trim();

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      let aiText = '';
      let usage: any = undefined;
      let providerUsed: 'openai' | 'gemini' = 'openai';

      const outgoingPayload = {
        model: String(req.body?.model || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL,
        temperature,
        messages,
      };

      if (OPENAI_KEY) {
        try {
          const r = await openaiChatMessages(messages, outgoingPayload.model, temperature);
          aiText = String(r?.content || '');
          providerUsed = 'openai';
          usage = r?.raw?.usage;
        } catch (e: any) {
          // Fallback to Gemini
          const combined = `${systemPrompt}\n\n${userMessage}\n\nReturn ONLY valid JSON (no markdown, no commentary).`;
          const r = await aiGenerateText({ prompt: combined, purpose: 'newspaper' as any });
          aiText = String(r?.text || '');
          usage = r?.usage;
          providerUsed = 'gemini';
        }
      } else {
        // Use Gemini
        const combined = `${systemPrompt}\n\n${userMessage}\n\nReturn ONLY valid JSON (no markdown, no commentary).`;
        const r = await aiGenerateText({ prompt: combined, purpose: 'newspaper' as any });
        aiText = String(r?.text || '');
        usage = r?.usage;
        providerUsed = 'gemini';
      }

      if (!aiText.trim()) {
        return res.status(500).json({ error: 'AI returned empty response', provider: providerUsed });
      }

      const parsed = tryParseJsonObject(aiText);
      if (!parsed) {
        return res.status(500).json({
          error: 'AI returned invalid JSON',
          provider: providerUsed,
          text: aiText.slice(0, 500),
          ...(debug ? { debug: { promptKey, systemPrompt: systemPrompt.slice(0, 500) } } : {})
        });
      }

      // Validate structure has required keys
      const requiredKeys = ['print_article', 'web_article', 'short_mobile_article', 'status'];
      const missingKeys = requiredKeys.filter(k => !parsed[k]);
      if (missingKeys.length > 0) {
        return res.status(500).json({
          error: `AI response missing required sections: ${missingKeys.join(', ')}`,
          provider: providerUsed,
          data: parsed,
        });
      }

      // Match AI's detected_category to input category names
      const aiDetectedCategory = String(parsed.detected_category || '').trim();
      let matchedCategoryName: string | null = null;
      let matchType: 'exact' | 'fuzzy' | 'fallback' = 'fallback';
      
      if (aiDetectedCategory) {
        // Try exact match first (case-insensitive)
        const exactMatch = categoryNames.find(name => 
          name.toLowerCase() === aiDetectedCategory.toLowerCase()
        );
        
        if (exactMatch) {
          matchedCategoryName = exactMatch;
          matchType = 'exact';
        } else {
          // Fuzzy match
          const fuzzyMatch = categoryNames.find(name => 
            name.toLowerCase().includes(aiDetectedCategory.toLowerCase()) ||
            aiDetectedCategory.toLowerCase().includes(name.toLowerCase())
          );
          
          if (fuzzyMatch) {
            matchedCategoryName = fuzzyMatch;
            matchType = 'fuzzy';
          }
        }
      }
      
      // Default to first category if no match found
      if (!matchedCategoryName && categoryNames.length > 0) {
        matchedCategoryName = categoryNames[0];
        matchType = 'fallback';
      }

      // Add selected_category to response - just the name, you match ID yourself
      const responseWithCategory = {
        ...parsed,
        selected_category: {
          name: matchedCategoryName,
          ai_detected: aiDetectedCategory,
          match_type: matchType
        }
      };

      if (debug) {
        return res.json({
          ...responseWithCategory,
          debug: {
            promptKey,
            provider: providerUsed,
            usage,
            model: outgoingPayload.model,
            inputCategories: categoryNames,
          }
        });
      }

      return res.json(responseWithCategory);
    } catch (e: any) {
      console.error('ai/rewrite/unified error', e);
      return res.status(500).json({ error: 'Failed to generate newsroom rewrite' });
    }
  }
);

/**
 * @swagger
 * /ai/rewrite/publish:
 *   post:
 *     summary: 3-in-1 AI Rewrite + Publish (Newspaper + Web + ShortNews)
 *     description: |
 *       **ONE API FOR EVERYTHING**
 *       
 *       This endpoint does:
 *       1. AI rewrites raw text → print + web + mobile articles
 *       2. Auto-detects category from your provided list
 *       3. Creates NewspaperArticle in database
 *       4. Creates TenantWebArticle in database
 *       5. Creates ShortNews in database
 *       
 *       All in ONE call!
 *     tags: [News Room]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rawText, categories, location]
 *             properties:
 *               rawText:
 *                 type: string
 *                 description: Raw reporter text
 *               categories:
 *                 type: array
 *                 items: { type: string }
 *                 description: Your database category names
 *                 example: ["Crime", "Accident", "Health"]
 *               location:
 *                 type: object
 *                 required: true
 *                 properties:
 *                   stateId: { type: string }
 *                   districtId: { type: string }
 *                   mandalId: { type: string }
 *               newspaperName:
 *                 type: string
 *                 example: "Daily News"
 *               language:
 *                 type: object
 *                 properties:
 *                   code: { type: string, example: "te" }
 *                   name: { type: string, example: "Telugu" }
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url: { type: string }
 *                     caption: { type: string }
 *     responses:
 *       201:
 *         description: All 3 articles created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 ai_response: { type: object }
 *                 articles:
 *                   type: object
 *                   properties:
 *                     newspaper: { type: object }
 *                     web: { type: object }
 *                     shortNews: { type: object }
 */
router.post(
  '/rewrite/publish',
  passport.authenticate('jwt', { session: false }),
  requireReporterOrAdmin,
  async (req: Request, res: Response) => {
    try {
      const rawText = String(req.body?.rawText ?? '').trim();
      const newspaperName = String(req.body?.newspaperName ?? '').trim() || 'News';
      const language = req.body?.language || { code: 'te', name: 'Telugu', script: 'Telugu', region: 'India' };
      const location = req.body?.location;
      const images = Array.isArray(req.body?.images) ? req.body.images : [];
      
      // Validate required fields
      if (!rawText) {
        return res.status(400).json({ error: 'rawText is required' });
      }
      
      if (!location || typeof location !== 'object') {
        return res.status(400).json({ 
          error: 'location is required',
          details: 'Provide location with stateId OR districtId OR mandalId'
        });
      }
      
      const hasLocationId = Boolean(location.stateId || location.districtId || location.mandalId || location.villageId);
      if (!hasLocationId) {
        return res.status(400).json({ 
          error: 'location id required',
          details: 'Provide at least one: stateId, districtId, or mandalId'
        });
      }

      // Get user and tenant info
      const user: any = (req as any).user;
      let tenantId: string | null = null;
      
      if (user?.role?.name === 'SUPER_ADMIN') {
        tenantId = req.body?.tenantId ? String(req.body.tenantId).trim() : null;
        if (!tenantId) {
          return res.status(400).json({ error: 'tenantId required for SUPER_ADMIN' });
        }
      } else {
        const reporter = await (prisma as any).reporter.findFirst({
          where: { userId: user.id },
          select: { tenantId: true }
        }).catch(() => null);
        tenantId = reporter?.tenantId || null;
      }
      
      if (!tenantId) {
        return res.status(400).json({ error: 'Could not determine tenant' });
      }

      // Get categories
      const categoriesInput = req.body?.categories;
      let categoryNames: string[] = [];
      
      if (Array.isArray(categoriesInput) && categoriesInput.length > 0) {
        categoryNames = categoriesInput
          .map((c: any) => typeof c === 'string' ? c.trim() : String(c?.name || '').trim())
          .filter(Boolean);
      }
      
      if (categoryNames.length === 0) {
        // Fallback to global categories
        const globalCategories = await prisma.category.findMany({
          where: { isDeleted: false },
          select: { name: true }
        }).catch(() => []);
        categoryNames = globalCategories.map((c: any) => c.name);
      }
      
      if (categoryNames.length === 0) {
        return res.status(400).json({ error: 'No categories available' });
      }

      // Get prompt
      const promptKey = 'newsroom_ai_agent';
      const dbPrompt = await (prisma as any).prompt.findUnique({ where: { key: promptKey } }).catch(() => null);
      let systemPrompt = String(dbPrompt?.content || '').trim();
      
      if (!systemPrompt || systemPrompt.startsWith('DEPRECATED')) {
        const defaultPrompt = DEFAULT_PROMPTS.find(dp => dp.key === promptKey);
        systemPrompt = defaultPrompt?.content || '';
      }
      
      if (!systemPrompt) {
        return res.status(400).json({ error: 'Prompt not found' });
      }

      // Build AI message
      const categoriesListStr = categoryNames.join(', ');
      const userMessage = `
RAW_NEWS_TEXT:
${rawText}

AVAILABLE_CATEGORIES (pick EXACTLY ONE):
${categoriesListStr}

NEWSPAPER_NAME: ${newspaperName}

LANGUAGE:
${JSON.stringify(language, null, 2)}
`.trim();

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      // Call AI
      let aiText = '';
      let providerUsed: 'openai' | 'gemini' = 'openai';
      const model = String(req.body?.model || DEFAULT_OPENAI_MODEL).trim();

      if (OPENAI_KEY) {
        try {
          const r = await openaiChatMessages(messages, model, 0.2);
          aiText = String(r?.content || '');
          providerUsed = 'openai';
        } catch {
          const combined = `${systemPrompt}\n\n${userMessage}\n\nReturn ONLY valid JSON.`;
          const r = await aiGenerateText({ prompt: combined, purpose: 'newspaper' as any });
          aiText = String(r?.text || '');
          providerUsed = 'gemini';
        }
      } else {
        const combined = `${systemPrompt}\n\n${userMessage}\n\nReturn ONLY valid JSON.`;
        const r = await aiGenerateText({ prompt: combined, purpose: 'newspaper' as any });
        aiText = String(r?.text || '');
        providerUsed = 'gemini';
      }

      if (!aiText.trim()) {
        return res.status(500).json({ error: 'AI returned empty response' });
      }

      const parsed = tryParseJsonObject(aiText);
      if (!parsed) {
        return res.status(500).json({ error: 'AI returned invalid JSON', text: aiText.slice(0, 500) });
      }

      // Validate AI response
      const requiredKeys = ['print_article', 'web_article', 'short_mobile_article'];
      const missingKeys = requiredKeys.filter(k => !parsed[k]);
      if (missingKeys.length > 0) {
        return res.status(500).json({ error: `AI missing: ${missingKeys.join(', ')}`, data: parsed });
      }

      // Match category
      const aiDetectedCategory = String(parsed.detected_category || '').trim();
      let matchedCategoryName = categoryNames.find(n => n.toLowerCase() === aiDetectedCategory.toLowerCase())
        || categoryNames.find(n => n.toLowerCase().includes(aiDetectedCategory.toLowerCase()) || aiDetectedCategory.toLowerCase().includes(n.toLowerCase()))
        || categoryNames[0];

      // Get category ID from database
      const categoryRecord = await prisma.category.findFirst({
        where: { name: matchedCategoryName, isDeleted: false },
        select: { id: true, name: true }
      }).catch(() => null);

      const categoryId = categoryRecord?.id || null;

      // Prepare article data from AI response
      const printArticle = parsed.print_article;
      const webArticle = parsed.web_article;
      const shortArticle = parsed.short_mobile_article;

      // Build newspaper article payload
      const languageCode = String(language.code || 'te').trim();
      const title = String(printArticle.headline || '').trim();
      const subTitle = printArticle.subtitle || undefined;
      const dateline = printArticle.dateline;
      const datelineStr = dateline ? `${dateline.place || ''}, ${dateline.date || ''} (${dateline.newspaper || ''})`.trim() : '';
      
      const bodyParagraphs = Array.isArray(printArticle.body) ? printArticle.body : [];
      const content = bodyParagraphs.map((p: string) => ({ type: 'paragraph', text: String(p || '').trim() }));
      
      const highlights = Array.isArray(printArticle.highlights) ? printArticle.highlights : [];
      const tags = Array.isArray(webArticle.seo?.keywords) ? webArticle.seo.keywords.slice(0, 10) : [];
      
      // Media
      const mediaImages = images.length > 0 
        ? images.map((img: any) => ({ url: String(img.url || ''), caption: String(img.caption || '') }))
        : [];
      const coverImageUrl = mediaImages[0]?.url || null;

      // Import newspaper controller create function
      const { createNewspaperArticle } = await import('../articles/newspaper.controller');
      
      // Build the request body for newspaper article
      const articlePayload = {
        title,
        subTitle,
        heading: title,
        language: languageCode,
        dateLine: datelineStr,
        bulletPoints: highlights,
        content,
        tags,
        location,
        media: { images: mediaImages },
        seo: webArticle.seo ? {
          metaTitle: webArticle.seo.meta_title,
          metaDescription: webArticle.seo.meta_description
        } : undefined,
        categoryId,
        // Pass web and short articles for unified creation
        web_article: webArticle,
        short_mobile_article: shortArticle
      };

      // Create a mock request/response to call the controller
      const mockReq = {
        ...req,
        body: articlePayload
      } as Request;

      // Create newspaper article (which also creates web + short)
      let createdArticles: any = null;
      const mockRes = {
        status: (code: number) => ({
          json: (data: any) => {
            if (code >= 400) {
              throw new Error(data.error || 'Failed to create article');
            }
            createdArticles = data;
          }
        }),
        json: (data: any) => {
          createdArticles = data;
        },
        locals: (res as any).locals
      } as any;

      await createNewspaperArticle(mockReq, mockRes);

      // Build response
      return res.status(201).json({
        success: true,
        message: 'All 3 articles created successfully',
        selected_category: {
          name: matchedCategoryName,
          id: categoryId,
          ai_detected: aiDetectedCategory
        },
        ai_response: {
          print_article: printArticle,
          web_article: webArticle,
          short_mobile_article: shortArticle,
          images: parsed.images,
          internal_evidence: parsed.internal_evidence,
          status: parsed.status
        },
        articles: createdArticles?.data || createdArticles
      });

    } catch (e: any) {
      console.error('ai/rewrite/publish error', e);
      return res.status(500).json({ error: e.message || 'Failed to publish articles' });
    }
  }
);

export default router;
