import { Router } from 'express';
import { AI_PROVIDER, AI_USE_GEMINI, AI_USE_OPENAI, DEFAULT_OPENAI_MODEL_SEO, DEFAULT_GEMINI_MODEL_SEO, OPENAI_KEY, GEMINI_KEY } from '../../lib/aiConfig';
import { pingAIProviders } from '../../lib/aiDiagnostics';

const router = Router();

/**
 * @swagger
 * /health/ai:
 *   get:
 *     summary: AI provider health
 *     description: |
 *       Returns AI provider configuration and key presence.
 *       Optional `ping=true` performs a quick readiness check against providers with short timeouts and minimal tokens.
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: ping
 *         required: false
 *         schema:
 *           type: boolean
 *         description: When true, performs quick connectivity checks to OpenAI and Gemini.
 *     responses:
 *       200:
 *         description: Health status
 *         content:
 *           application/json:
 *             examples:
 *               base:
 *                 value:
 *                   provider: openai
 *                   useOpenAI: true
 *                   useGemini: true
 *                   openai:
 *                     keyPresent: true
 *                     defaultModel: gpt-4.1-mini
 *                   gemini:
 *                     keyPresent: true
 *                     defaultModel: gemini-2.0-flash
 *               ping:
 *                 value:
 *                   provider: openai
 *                   useOpenAI: true
 *                   useGemini: true
 *                   openai:
 *                     provider: openai
 *                     keyPresent: true
 *                     reachable: true
 *                     model: gpt-4.1-mini
 *                   gemini:
 *                     provider: gemini
 *                     keyPresent: true
 *                     reachable: true
 *                     model: gemini-2.0-flash
 */
router.get('/ai', async (req, res) => {
  const ping = String(req.query.ping || '').toLowerCase() === 'true';
  const base = {
    provider: AI_PROVIDER,
    useOpenAI: AI_USE_OPENAI,
    useGemini: AI_USE_GEMINI,
    openai: {
      keyPresent: !!OPENAI_KEY,
      defaultModel: DEFAULT_OPENAI_MODEL_SEO,
    },
    gemini: {
      keyPresent: !!GEMINI_KEY,
      defaultModel: DEFAULT_GEMINI_MODEL_SEO,
    },
  } as any;

  if (!ping) return res.json(base);

  try {
    const status = await pingAIProviders();
    base.openai = { ...base.openai, ...status.openai };
    base.gemini = { ...base.gemini, ...status.gemini };
    return res.json(base);
  } catch (e: any) {
    return res.status(500).json({ ...base, error: e?.message || 'Failed to ping providers' });
  }
});

export default router;
