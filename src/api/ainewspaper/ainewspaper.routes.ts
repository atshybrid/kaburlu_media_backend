import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireReporterOrAdmin } from '../middlewares/authz';
import { aiGenerateText } from '../../lib/aiProvider';
import { OPENAI_KEY } from '../../lib/aiConfig';

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

async function openaiChatMessages(messages: Array<{ role: 'system' | 'user'; content: string }>, model: string) {
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
        temperature: 0.2,
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
      const fallbackModel = 'gpt-4o-mini';
      const resp = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: fallbackModel,
          messages,
          temperature: 0.2,
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
 *     summary: AI newspaper rewrite (system prompt from DB)
 *     description: |
 *       Loads prompt content from Prompt table key `daily_newspaper_ai_article_dynamic_language`.
 *       Sends it as the **system** message, and sends the raw reporter post as the **user** message.
 *       Returns the AI JSON output parsed as an object.
 *
 *       Allowed roles: SUPER_ADMIN, TENANT_ADMIN, TENANT_EDITOR, ADMIN_EDITOR, NEWS_MODERATOR, REPORTER.
 *     tags: [AI Rewrite]
 *     security: [ { bearerAuth: [] } ]
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
 *                 description: Raw Telugu reporter post
 *               model:
 *                 type: string
 *                 description: Optional OpenAI model override (used only when OPENAI_API_KEY is configured)
 *                 example: gpt-4o
 *           examples:
 *             sample:
 *               value:
 *                 model: gpt-4o
 *                 rawText: "<<< RAW TELUGU REPORTER POST >>>"
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
      if (!rawText) return res.status(400).json({ error: 'rawText is required' });

      const debug = String((req.query as any)?.debug || '').toLowerCase() === 'true';

      const promptKey = 'daily_newspaper_ai_article_dynamic_language';
      const p = await (prisma as any).prompt.findUnique({ where: { key: promptKey } }).catch(() => null);
      const systemPrompt = String(p?.content || '').trim();
      if (!systemPrompt) return res.status(400).json({ error: `Prompt not found for key: ${promptKey}` });

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawText },
      ];

      // Preferred: OpenAI chat messages (matches the requested system/user format)
      let aiText = '';
      let usage: any = undefined;
      let providerUsed: 'openai' | 'gemini' | 'auto' = 'auto';

      // This is the exact payload shape we send to OpenAI (excluding secrets like OPENAI_API_KEY).
      // Returned ONLY when debug=true.
      const outgoingChatGptPayload = {
        model: String(req.body?.model || 'gpt-4o').trim() || 'gpt-4o',
        messages,
      };

      if (OPENAI_KEY) {
        const model = outgoingChatGptPayload.model;
        const r = await openaiChatMessages(
          messages,
          model
        );
        aiText = String(r?.content || '');
        providerUsed = 'openai';
        usage = r?.raw?.usage;
      } else {
        // Fallback: configured provider (Gemini/OpenAI via aiProvider) with a combined prompt
        const combined = `${systemPrompt}\n\n<<< RAW TELUGU REPORTER POST >>>\n${rawText}\n\nReturn ONLY valid JSON (no markdown, no commentary).`;
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

export default router;
