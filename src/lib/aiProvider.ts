import {
  AI_PROVIDER,
  AI_TIMEOUT_MS,
  GEMINI_KEY,
  OPENAI_KEY,
  DEFAULT_GEMINI_MODEL_SEO,
  DEFAULT_GEMINI_MODEL_REWRITE,
  DEFAULT_GEMINI_MODEL_TRANSLATION,
  DEFAULT_GEMINI_MODEL_MODERATION,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_OUTPUT_TOKENS_REWRITE,
  DEFAULT_MAX_OUTPUT_TOKENS_DEFAULT,
  DEFAULT_OPENAI_MODEL_SEO,
  DEFAULT_OPENAI_MODEL_TRANSLATION,
  DEFAULT_OPENAI_MODEL_MODERATION,
  DEFAULT_OPENAI_MODEL_REWRITE,
  DEFAULT_OPENAI_MODEL_NEWSPAPER,
  AI_PARALLEL_RACE,
} from './aiConfig';

type AIPurpose = 'seo' | 'moderation' | 'translation' | 'rewrite' | 'shortnews_ai_article' | 'newspaper';

export async function aiGenerateText({ prompt, purpose }: { prompt: string; purpose: AIPurpose }): Promise<{ text: string; usage?: any }> {
  const provider = AI_PROVIDER;

  // Provider selection rules:
  // - For `translation` purpose: prefer Gemini when enabled.
  // - For other purposes: prefer OpenAI when enabled.
  // - Fall back to the other provider if the preferred one is unavailable/fails.
  const preferGeminiForTranslation = purpose === 'translation';
  const preferGemini = preferGeminiForTranslation
    ? ((typeof (process as any)?.env?.AI_USE_GEMINI !== 'undefined') ? true : true)
    : false;

  const geminiAllowed = !!GEMINI_KEY && (preferGeminiForTranslation ? true : true);
  const openaiAllowed = !!OPENAI_KEY;

  const useGeminiFirst = purpose === 'translation'
    ? (geminiAllowed && (provider === 'gemini' || true))
    : (provider === 'gemini' && geminiAllowed);

  // NOTE: AI_USE_GEMINI/AI_USE_OPENAI flags live in aiConfig; we honor them here.
  // We intentionally keep AI_PROVIDER as a baseline preference, but purpose-specific
  // routing overrides it when the corresponding AI_USE_* flag is set.
  const { AI_USE_GEMINI, AI_USE_OPENAI } = require('./aiConfig');

  const shouldTryGeminiFirst = purpose === 'translation'
    ? (AI_USE_GEMINI && geminiAllowed)
    : ((provider === 'gemini' && geminiAllowed) || (!AI_USE_OPENAI && geminiAllowed));

  const shouldTryOpenAIFirst = purpose === 'translation'
    ? (!shouldTryGeminiFirst && AI_USE_OPENAI && openaiAllowed)
    : (AI_USE_OPENAI && openaiAllowed) || (provider === 'openai' && openaiAllowed);

  const tryGemini = async () => {
    if (!geminiAllowed) return { text: '' as string, usage: undefined as any };
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      // Pick model based on purpose
      const modelName = (() => {
        if (purpose === 'rewrite' || purpose === 'shortnews_ai_article' || purpose === 'newspaper') return (DEFAULT_GEMINI_MODEL_REWRITE || DEFAULT_GEMINI_MODEL_SEO);
        if (purpose === 'translation') return DEFAULT_GEMINI_MODEL_TRANSLATION;
        if (purpose === 'moderation') return DEFAULT_GEMINI_MODEL_MODERATION;
        return DEFAULT_GEMINI_MODEL_SEO;
      })();
      
      // Configure safety settings to be less restrictive for news content
      const safetySettings = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ];
      
      const model = genAI.getGenerativeModel({ 
        model: modelName,
        safetySettings 
      });
      
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
      // Keep outputs bounded to reduce latency; callers expect plain text or JSON in text form
      const generationConfig: any = {
        temperature: DEFAULT_TEMPERATURE,
        maxOutputTokens: (purpose === 'rewrite' || purpose === 'shortnews_ai_article' || purpose === 'newspaper')
          ? DEFAULT_MAX_OUTPUT_TOKENS_REWRITE
          : DEFAULT_MAX_OUTPUT_TOKENS_DEFAULT,
      };
      const res = await model.generateContent({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }, { signal: ctrl.signal }).finally(() => clearTimeout(t));
      
      // Check for safety blocks
      const response = res?.response;
      const promptFeedback = response?.promptFeedback;
      
      if (promptFeedback?.blockReason) {
        console.warn(`[AI][gemini] Content blocked - ${promptFeedback.blockReason}:`, promptFeedback);
        return { text: '' };
      }
      
      // Check if response was blocked
      if (!response?.candidates || response.candidates.length === 0) {
        console.warn('[AI][gemini] No candidates returned - possible safety filter');
        return { text: '' };
      }
      
      const candidate = response.candidates[0];
      if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
        console.warn(`[AI][gemini] Response finished with reason: ${candidate.finishReason}`);
        // Try to get partial text anyway
      }
      
      const text = res?.response?.text?.() || '';
      const usage = {
        provider: 'gemini',
        purpose,
        promptChars: prompt.length,
        responseChars: text.length,
        model: modelName,
      };
      if (text) return { text, usage };
    } catch (e: any) {
      console.warn(`[AI][gemini] ${purpose} call failed:`, e?.message || e);
    }
    return { text: '' };
  };

  const tryOpenAI = async () => {
    if (!openaiAllowed) return { text: '' as string, usage: undefined as any };
    
    // Support fallback API key for quota/rate limit resilience
    const { OPENAI_KEY_FALLBACK } = require('./aiConfig');
    const keysToTry = [OPENAI_KEY, OPENAI_KEY_FALLBACK].filter(Boolean);
    
    if (keysToTry.length === 0) {
      return { text: '' };
    }
    
    try {
      // Lazy import to avoid bundling
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const axios = require('axios');
      const model = purpose === 'translation'
        ? DEFAULT_OPENAI_MODEL_TRANSLATION
        : (purpose === 'moderation'
          ? DEFAULT_OPENAI_MODEL_MODERATION
          : (purpose === 'rewrite' || purpose === 'shortnews_ai_article'
            ? DEFAULT_OPENAI_MODEL_REWRITE
            : (purpose === 'newspaper' ? DEFAULT_OPENAI_MODEL_NEWSPAPER : DEFAULT_OPENAI_MODEL_SEO)));
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
      
      const callOpenAIChat = async (m: string, apiKey: string) => {
        // Optimize for long articles (6000+ words)
        const maxTokens = purpose === 'rewrite' || purpose === 'newspaper' || purpose === 'shortnews_ai_article' 
          ? 10000  // Allow up to 10K tokens output for long articles
          : undefined;
        
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: m,
          messages: [
            // Skip generic system prompt - all instructions in user prompt for efficiency
            { role: 'user', content: prompt }
          ],
          temperature: DEFAULT_TEMPERATURE,
          max_tokens: maxTokens,
        }, {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          signal: ctrl.signal,
        });
        const data = response?.data;
        const content = data?.choices?.[0]?.message?.content || '';
        return { data, content };
      };

      let data: any;
      let content = '';
      let usedFallback = false;
      
      // Try primary key first
      try {
        const r1 = await callOpenAIChat(model, keysToTry[0]);
        data = r1.data;
        content = r1.content;
      } catch (e: any) {
        const status = e?.response?.status;
        const errMsg = e?.response?.data?.error?.message || e?.message || '';
        
        // If primary key failed with quota/auth/rate limit, try fallback key
        const shouldTryFallback = keysToTry.length > 1 && 
          (status === 429 || status === 401 || status === 403 || 
           /quota|rate.?limit|insufficient/i.test(String(errMsg)));
        
        if (shouldTryFallback) {
          console.warn(`[AI][openai] Primary key failed (${status}), trying fallback key...`);
          try {
            const r2 = await callOpenAIChat(model, keysToTry[1]);
            data = r2.data;
            content = r2.content;
            usedFallback = true;
            console.log(`[AI][openai] ✓ Fallback key succeeded for ${purpose}`);
          } catch (e2: any) {
            const status2 = e2?.response?.status;
            const errMsg2 = e2?.response?.data?.error?.message || e2?.message || '';
            console.warn(`[AI][openai] Fallback key also failed (${status2}):`, errMsg2);
            throw e2;
          }
        } else {
          // Common fix: env points to a model not available on the account.
          // Retry once with a safe fallback model.
          const looksLikeModelIssue = status === 400 && /model/i.test(String(errMsg));
          if (looksLikeModelIssue) {
            try {
              const fallbackModel = 'gpt-4.1-mini';
              const r2 = await callOpenAIChat(fallbackModel, keysToTry[0]);
              data = r2.data;
              content = r2.content;
            } catch (e2: any) {
              throw e2;
            }
          } else {
            throw e;
          }
        }
      } finally {
        clearTimeout(t);
      }
      
      const usage = {
        provider: 'openai',
        purpose,
        prompt_tokens: data?.usage?.prompt_tokens,
        completion_tokens: data?.usage?.completion_tokens,
        total_tokens: data?.usage?.total_tokens,
        promptChars: prompt.length,
        responseChars: content.length,
        model,
        usedFallback,
      };
      if (content) return { text: content, usage };
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      console.warn(`[AI][openai] ${purpose} call failed:`, status || '', data?.error?.message || e?.message || e);
    }
    return { text: '' };
  };

  // SMART PARALLEL RACE MODE: Send requests to both providers simultaneously
  // Whichever responds first wins - significantly reduces latency when one provider is slow/busy
  const { AI_USE_GEMINI, AI_USE_OPENAI } = require('./aiConfig');
  
  if (AI_PARALLEL_RACE && geminiAllowed && openaiAllowed && AI_USE_GEMINI && AI_USE_OPENAI) {
    console.log(`[AI][race] Starting parallel race for ${purpose} (Gemini vs OpenAI)...`);
    const raceStart = Date.now();
    
    try {
      const result = await Promise.race([
        (async () => {
          const r = await tryGemini();
          if (r?.text) {
            console.log(`[AI][race] ✓ Gemini won! (${Date.now() - raceStart}ms)`);
            return { ...r, winner: 'gemini' };
          }
          return null;
        })(),
        (async () => {
          const r = await tryOpenAI();
          if (r?.text) {
            console.log(`[AI][race] ✓ OpenAI won! (${Date.now() - raceStart}ms)`);
            return { ...r, winner: 'openai' };
          }
          return null;
        })(),
      ]);
      
      if (result?.text) return result;
    } catch (e) {
      console.warn(`[AI][race] Race failed:`, e);
    }
  }

  // Execute with preferred order
  if (shouldTryGeminiFirst) {
    const r1 = await tryGemini();
    if (r1?.text) return r1;
    const r2 = await tryOpenAI();
    if (r2?.text) return r2;
    return { text: '' };
  }

  if (shouldTryOpenAIFirst) {
    const r1 = await tryOpenAI();
    if (r1?.text) return r1;
    const r2 = await tryGemini();
    if (r2?.text) return r2;
    return { text: '' };
  }

  // Last resort: honor AI_PROVIDER baseline
  if (provider === 'gemini') {
    const r = await tryGemini();
    if (r?.text) return r;
    const r2 = await tryOpenAI();
    if (r2?.text) return r2;
    return { text: '' };
  }

  const r = await tryOpenAI();
  if (r?.text) return r;
  const r2 = await tryGemini();
  if (r2?.text) return r2;
  return { text: '' };
}

export async function openaiRespond(input: string, model = 'gpt-4o'): Promise<{ text: string; raw: any }> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const axios = require('axios');
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_KEY');
  const response = await axios.post('https://api.openai.com/v1/responses', { model, input }, {
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }
  });
  const data = response?.data;
  const text = Array.isArray(data?.output?.[0]?.content)
    ? data.output[0].content.map((c: any) => c.text || '').join('\n')
    : (data?.output_text || data?.output || '');
  return { text, raw: data };
}
