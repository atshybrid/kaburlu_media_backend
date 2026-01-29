import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireReporterOrAdmin } from '../middlewares/authz';
import { aiGenerateText } from '../../lib/aiProvider';
import { OPENAI_KEY } from '../../lib/aiConfig';

const DEFAULT_OPENAI_MODEL = String(process.env.OPENAI_MODEL_REWRITE || 'gpt-4o-mini');

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
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 45_000);
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  const call = async (m: string) => {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: m,
        messages,
        temperature,
        // Best-effort strict JSON mode; if unsupported, OpenAI will error and we fall back.
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

      // Retry once with a safe, commonly available fallback and without strict JSON mode
      const fallbackModel = DEFAULT_OPENAI_MODEL || 'gpt-4o-mini';
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
 * /ainewspaper_rewrite:
 *   post:
 *     summary: "[DEPRECATED] AI newspaper rewrite - Use /api/v1/ai/rewrite/unified instead"
 *     deprecated: true
 *     description: |
 *       ⚠️ **DEPRECATED**: This endpoint is deprecated. Use `POST /api/v1/ai/rewrite/unified` instead.
 *       
 *       The new unified endpoint returns all three article formats (print, web, short) in a single call.
 *       
 *       ---
 *       
 *       Legacy behavior:
 *       Loads prompt content from Prompt table key `daily_newspaper_ai_article_dynamic_language`.
 *       Sends it as the **system** message, and sends the raw reporter post as the **user** message.
 *       Returns the AI JSON output parsed as an object.
 *
 *       Allowed roles: SUPER_ADMIN, TENANT_ADMIN, TENANT_EDITOR, ADMIN_EDITOR, NEWS_MODERATOR, REPORTER.
 *     tags: [AI Rewrite (Deprecated)]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: debug
 *         required: false
 *         schema:
 *           type: boolean
 *         description: When true, includes promptKey, systemPrompt, provider, outgoing payload, and usage in the response.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rawText:
 *                 type: string
 *                 description: Raw reporter post text (e.g., Telugu). Used with DB prompt when `messages` is not provided.
 *               allowedCategories:
 *                 type: array
 *                 description: Optional category guidance used only with DB prompt mode.
 *                 items:
 *                   type: string
 *                 example: ["Crime", "Local News", "State News"]
 *               model:
 *                 type: string
 *                 description: Optional OpenAI model override (used only when OPENAI_API_KEY is configured)
 *                 example: gpt-4.1-mini
 *               temperature:
 *                 type: number
 *                 description: Optional generation temperature (defaults to 0.2). Passed to OpenAI; Gemini uses its own defaults.
 *                 example: 0.2
 *               messages:
 *                 type: array
 *                 description: Optional direct Chat Completions messages. When provided, DB prompt is ignored and these are sent to OpenAI.
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user]
 *                     content:
 *                       type: string
 *           examples:
 *             rawMode:
 *               summary: Raw text + allowed categories (DB prompt mode)
 *               value:
 *                 rawText: "నగరంలో శుక్రవారం రాత్రి జరిగిన రోడ్డు ప్రమాదంలో ఇద్దరు గాయపడ్డారు..."
 *                 allowedCategories: ["Crime", "Local News", "State News"]
 *                 temperature: 0.2
 *                 model: gpt-4.1-mini
 *             messagesMode:
 *               summary: Direct ChatGPT messages (bypass DB prompt)
 *               value:
 *                 model: "gpt-4.1-mini"
 *                 temperature: 0.2
 *                 messages:
 *                   - role: system
 *                     content: "You are a professional daily newspaper editor and senior journalist..."
 *                   - role: user
 *                     content: |
 *                       RAW_REPORTER_POST:
 *                       నగరంలో శుక్రవారం రాత్రి జరిగిన రోడ్డు ప్రమాదంలో ఇద్దరు గాయపడ్డారు...
 *
 *                       ALLOWED_CATEGORIES:
 *                       Crime, Local News, State News
 *     responses:
 *       200:
 *         description: AI rewritten newspaper JSON
 *         content:
 *           application/json:
 *             example:
 *               category: "Local News"
 *               title: "ముగ్గుల పోటీలో ముఖ్య అతిథిగా బండి రమేష్"
 *               subtitle: "బాలాజీ నగర్‌లో ఏబీఎన్ ఆధ్వర్యంలో పండుగ కార్యక్రమం"
 *               lead: "పండుగ సందర్భంగా ఏబీఎన్ ఆంధ్రజ్యోతి ఆధ్వర్యంలో నిర్వహించిన ముగ్గుల పోటీలకు టీపీసీసీ ఉపాధ్యక్షుడు బండి రమేష్ ముఖ్య అతిథిగా హాజరయ్యారు."
 *               highlights:
 *                 - "ఏబీఎన్ ఆంధ్రజ్యోతి ఆధ్వర్యంలో ముగ్గుల పోటీలు"
 *                 - "కేపిహెచ్‌బీ కాలనీ రమ్య మైదానంలో నిర్వహణ"
 *                 - "ముఖ్య అతిథిగా బండి రమేష్ పాల్గొనడం"
 *                 - "నిర్వాహకులుగా వేణు, హరికృష్ణ"
 *               article:
 *                 location_date: "(కేపిహెచ్‌బీ కాలనీ, జనవరి)"
 *                 body: "పండుగను పురస్కరించుకుని ..."
 *       400:
 *         description: Bad input or missing prompt key in DB
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: AI failure or invalid JSON output
 */
router.post(
  '/ainewspaper_rewrite',
  passport.authenticate('jwt', { session: false }),
  requireReporterOrAdmin,
  async (req, res) => {
    try {
      const rawText = String(req.body?.rawText ?? req.body?.raw ?? req.body?.text ?? req.body?.content ?? '').trim();
      const allowedCategoriesInput = req.body?.allowedCategories;
      const allowedCategories: string[] = Array.isArray(allowedCategoriesInput)
        ? allowedCategoriesInput.map((c: any) => String(c)).filter(Boolean)
        : [];
      const temperature = Number(req.body?.temperature ?? 0.2);
      if (!rawText) return res.status(400).json({ error: 'rawText is required' });

      const debug = String((req.query as any)?.debug || '').toLowerCase() === 'true';

      const promptKey = 'daily_newspaper_ai_article_dynamic_language';
      const providedMessages = Array.isArray(req.body?.messages)
        ? (req.body.messages as Array<{ role: 'system' | 'user'; content: string }>).filter(m => m && (m.role === 'system' || m.role === 'user') && typeof m.content === 'string')
        : null;

      let systemPrompt = '';
      let messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (providedMessages && providedMessages.length) {
        messages = providedMessages;
      } else {
        const p = await (prisma as any).prompt.findUnique({ where: { key: promptKey } }).catch(() => null);
        systemPrompt = String(p?.content || '').trim();
        if (!systemPrompt) return res.status(400).json({ error: `Prompt not found for key: ${promptKey}` });

          const userContent = allowedCategories.length
            ? `RAW_REPORTER_POST:\n${rawText}\n\nALLOWED_CATEGORIES:\n${allowedCategories.join(', ')}`
          : rawText;

        messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ];
      }

      // Preferred: OpenAI chat messages (matches the requested system/user format)
      let aiText = '';
      let usage: any = undefined;
      let providerUsed: 'openai' | 'gemini' | 'auto' = 'auto';

      // This is the exact payload shape we send to OpenAI (excluding secrets like OPENAI_API_KEY).
      // Returned ONLY when debug=true.
      const outgoingChatGptPayload = {
        model: String(req.body?.model || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL,
        temperature,
        messages,
      };

      if (OPENAI_KEY) {
        const model = outgoingChatGptPayload.model;
        try {
          const r = await openaiChatMessages(
            messages,
            model,
            temperature
          );
          aiText = String(r?.content || '');
          providerUsed = 'openai';
          usage = r?.raw?.usage;
        } catch (e: any) {
          const status = e?.response?.status;
          const ideCode = e?.response?.headers?.['x-openai-ide-error-code'] || '';
          if (status === 401 || /invalid_api_key/i.test(String(ideCode))) {
            // Fallback to Gemini if OpenAI key invalid
              const combined = `${systemPrompt}\n\n<<< RAW TELUGU REPORTER POST >>>\n${rawText}\n\n${allowedCategories.length ? `ALLOWED_CATEGORIES: ${allowedCategories.join(', ')}` : ''}\n\nReturn ONLY valid JSON (no markdown, no commentary).`;
            const r = await aiGenerateText({ prompt: combined, purpose: 'newspaper' as any });
            aiText = String(r?.text || '');
            usage = r?.usage;
            providerUsed = 'gemini';
          } else {
            throw e;
          }
        }
      } else {
        // Fallback: configured provider (Gemini/OpenAI via aiProvider) with a combined prompt
          const combined = `${systemPrompt}\n\n<<< RAW TELUGU REPORTER POST >>>\n${rawText}\n\n${allowedCategories.length ? `ALLOWED_CATEGORIES: ${allowedCategories.join(', ')}` : ''}\n\nReturn ONLY valid JSON (no markdown, no commentary).`;
        const r = await aiGenerateText({ prompt: combined, purpose: 'newspaper' as any });
        aiText = String(r?.text || '');
        usage = r?.usage;
        providerUsed = 'gemini';
      }

      if (!aiText.trim()) return res.status(500).json({ error: 'AI returned empty response', provider: providerUsed });

      const parsed = tryParseJsonObject(aiText);
      if (!parsed) {
        return res.status(500).json({
          error: 'AI returned invalid JSON',
          provider: providerUsed,
          text: aiText,
          ...(debug ? {
            debug: {
              promptKey,
              systemPrompt,
              outgoingChatGptPayload,
            }
          } : {})
        });
      }

      // In debug mode, include prompt + outgoing payload for easy verification.
      if (debug) {
        return res.json({
          data: parsed,
          debug: {
            promptKey,
            systemPrompt,
            provider: providerUsed,
            outgoingChatGptPayload,
            usage,
          }
        });
      }

      return res.json(parsed);
    } catch (e: any) {
      console.error('ainewspaper_rewrite error', e);
      return res.status(500).json({ error: 'Failed to generate newspaper rewrite' });
    }
  }
);

/**
 * @swagger
 * /ainewspaper_rewrite/unified:
 *   post:
 *     summary: AI unified rewrite - returns newspaper + web + shortNews in one call
 *     description: |
 *       Single AI call that returns all 3 article formats:
 *       - **newspaper**: Print-ready newspaper article (title, subtitle, lead, highlights, body)
 *       - **web**: SEO-optimized web article (title, content, seoTitle, metaDescription, slug, keywords)
 *       - **shortNews**: Mobile app short news (title ≤35 chars, content ≤60 words)
 *
 *       Best practice flow:
 *       1. Call this endpoint with raw reporter text
 *       2. Show newspaper data to reporter for review/edit
 *       3. POST /articles/newspaper with edited newspaper + original web + shortNews
 *
 *       Uses prompt key `unified_article_rewrite` from Prompt table.
 *     tags: [AI Rewrite]
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
 *             required: [rawText]
 *             properties:
 *               rawText:
 *                 type: string
 *                 description: Raw reporter post text
 *                 example: "నగరంలో శుక్రవారం రాత్రి జరిగిన రోడ్డు ప్రమాదంలో ఇద్దరు గాయపడ్డారు..."
 *               allowedCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional list of allowed categories for AI to pick from
 *               temperature:
 *                 type: number
 *                 default: 0.2
 *                 description: AI temperature (0-1)
 *               model:
 *                 type: string
 *                 description: Optional OpenAI model override
 *     responses:
 *       200:
 *         description: Unified AI rewrite with all 3 article types
 *         content:
 *           application/json:
 *             example:
 *               newspaper:
 *                 category: "Crime"
 *                 title: "రోడ్డు ప్రమాదంలో ఇద్దరికి గాయాలు"
 *                 subtitle: "శుక్రవారం రాత్రి నగరంలో జరిగిన సంఘటన"
 *                 lead: "నగరంలో శుక్రవారం రాత్రి..."
 *                 highlights: ["ఇద్దరు గాయపడ్డారు", "పోలీసులు కేసు నమోదు"]
 *                 article:
 *                   location_date: "హైదరాబాద్, జనవరి 20"
 *                   body: "..."
 *               web:
 *                 title: "రోడ్డు ప్రమాదంలో ఇద్దరికి గాయాలు"
 *                 subTitle: "శుక్రవారం రాత్రి నగరంలో జరిగిన సంఘటన"
 *                 summary: "..."
 *                 content: "..."
 *                 seoTitle: "Road Accident Hyderabad Today"
 *                 metaDescription: "Two injured in road accident..."
 *                 slug: "road-accident-hyderabad-two-injured"
 *                 keywords: ["road accident", "hyderabad", "crime news"]
 *                 locationKeywords: ["hyderabad", "telangana"]
 *               shortNews:
 *                 title: "రోడ్డు ప్రమాదం - ఇద్దరికి గాయాలు"
 *                 subTitle: ""
 *                 content: "నగరంలో శుక్రవారం రాత్రి జరిగిన రోడ్డు ప్రమాదంలో ఇద్దరు గాయపడ్డారు."
 *       400:
 *         description: Bad input or missing prompt key in DB
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: AI failure or invalid JSON output
 */
router.post(
  '/ainewspaper_rewrite/unified',
  passport.authenticate('jwt', { session: false }),
  requireReporterOrAdmin,
  async (req, res) => {
    try {
      const rawText = String(req.body?.rawText ?? req.body?.raw ?? req.body?.text ?? req.body?.content ?? '').trim();
      const allowedCategoriesInput = req.body?.allowedCategories;
      const allowedCategories: string[] = Array.isArray(allowedCategoriesInput)
        ? allowedCategoriesInput.map((c: any) => String(c)).filter(Boolean)
        : [];
      const temperature = Number(req.body?.temperature ?? 0.2);
      if (!rawText) return res.status(400).json({ error: 'rawText is required' });

      const debug = String((req.query as any)?.debug || '').toLowerCase() === 'true';

      const promptKey = 'unified_article_rewrite';
      
      // Load prompt from DB
      const p = await (prisma as any).prompt.findUnique({ where: { key: promptKey } }).catch(() => null);
      let systemPrompt = String(p?.content || '').trim();
      
      // Fallback to default if not in DB
      if (!systemPrompt) {
        const { DEFAULT_PROMPTS } = await import('../../lib/defaultPrompts');
        const defaultPrompt = DEFAULT_PROMPTS.find(dp => dp.key === promptKey);
        systemPrompt = defaultPrompt?.content || '';
      }
      
      if (!systemPrompt) {
        return res.status(400).json({ error: `Prompt not found for key: ${promptKey}` });
      }

      const userContent = allowedCategories.length
        ? `RAW_REPORTER_POST:\n${rawText}\n\nALLOWED_CATEGORIES:\n${allowedCategories.join(', ')}`
        : rawText;

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];

      let aiText = '';
      let usage: any = undefined;
      let providerUsed: 'openai' | 'gemini' | 'auto' = 'auto';

      const outgoingChatGptPayload = {
        model: String(req.body?.model || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL,
        temperature,
        messages,
      };

      if (OPENAI_KEY) {
        const model = outgoingChatGptPayload.model;
        try {
          const r = await openaiChatMessages(messages, model, temperature);
          aiText = String(r?.content || '');
          providerUsed = 'openai';
          usage = r?.raw?.usage;
        } catch (e: any) {
          const status = e?.response?.status;
          const errMsg = e?.response?.data?.error?.message || e?.message || '';
          const looksLikeModelOrFormatIssue = status === 400 && /(model|response_format)/i.test(String(errMsg));
          if (!looksLikeModelOrFormatIssue) throw e;

          // Fallback to Gemini
          const combined = `${systemPrompt}\n\n<<< RAW REPORTER POST >>>\n${rawText}\n\n${allowedCategories.length ? `ALLOWED_CATEGORIES: ${allowedCategories.join(', ')}` : ''}\n\nReturn ONLY valid JSON (no markdown, no commentary).`;
          const r = await aiGenerateText({ prompt: combined, purpose: 'newspaper' as any });
          aiText = String(r?.text || '');
          usage = r?.usage;
          providerUsed = 'gemini';
        }
      } else {
        // Fallback: Gemini
        const combined = `${systemPrompt}\n\n<<< RAW REPORTER POST >>>\n${rawText}\n\n${allowedCategories.length ? `ALLOWED_CATEGORIES: ${allowedCategories.join(', ')}` : ''}\n\nReturn ONLY valid JSON (no markdown, no commentary).`;
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
          text: aiText,
          ...(debug ? { debug: { promptKey, systemPrompt, outgoingChatGptPayload } } : {})
        });
      }

      // Validate structure has required keys
      if (!parsed.newspaper || !parsed.web || !parsed.shortNews) {
        return res.status(500).json({
          error: 'AI response missing required sections (newspaper, web, shortNews)',
          provider: providerUsed,
          data: parsed,
          ...(debug ? { debug: { promptKey, systemPrompt, outgoingChatGptPayload } } : {})
        });
      }

      if (debug) {
        return res.json({
          ...parsed,
          debug: {
            promptKey,
            systemPrompt,
            provider: providerUsed,
            outgoingChatGptPayload,
            usage,
          }
        });
      }

      return res.json(parsed);
    } catch (e: any) {
      console.error('ainewspaper_rewrite/unified error', e);
      return res.status(500).json({ error: 'Failed to generate unified rewrite' });
    }
  }
);

export default router;
