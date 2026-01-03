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
  DEFAULT_OPENAI_MODEL_NEWSPAPER,
} from './aiConfig';

type AIPurpose = 'seo' | 'moderation' | 'translation' | 'rewrite' | 'shortnews_ai_article' | 'newspaper';

export async function aiGenerateText({ prompt, purpose }: { prompt: string; purpose: AIPurpose }): Promise<{ text: string; usage?: any }> {
  const provider = AI_PROVIDER;
  if (provider === 'gemini' && GEMINI_KEY) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      // Pick model based on purpose
      const modelName = (() => {
        if (purpose === 'rewrite' || purpose === 'shortnews_ai_article' || purpose === 'newspaper') return (DEFAULT_GEMINI_MODEL_REWRITE || DEFAULT_GEMINI_MODEL_SEO);
        if (purpose === 'translation') return DEFAULT_GEMINI_MODEL_TRANSLATION;
        if (purpose === 'moderation') return DEFAULT_GEMINI_MODEL_MODERATION;
        return DEFAULT_GEMINI_MODEL_SEO;
      })();
      const model = genAI.getGenerativeModel({ model: modelName });
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
      if (purpose === 'translation') {
        console.warn('[AI][gemini] translation call failed:', e?.message || e);
      }
    }
  }
  if (OPENAI_KEY) {
    try {
      // Lazy import to avoid bundling
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const axios = require('axios');
      const model = purpose === 'translation'
        ? DEFAULT_OPENAI_MODEL_TRANSLATION
        : (purpose === 'moderation'
          ? DEFAULT_OPENAI_MODEL_MODERATION
          : (purpose === 'newspaper' ? DEFAULT_OPENAI_MODEL_NEWSPAPER : DEFAULT_OPENAI_MODEL_SEO));
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
      const callOpenAI = async (m: string) => {
        const response = await axios.post('https://api.openai.com/v1/responses', {
          model: m,
          input: prompt
        }, {
          headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
          signal: ctrl.signal,
        });
        const data = response?.data;
        const content = Array.isArray(data?.output?.[0]?.content)
          ? data.output[0].content.map((c: any) => c.text || '').join('\n')
          : (data?.output_text || data?.output || '');
        return { data, content };
      };

      let data: any;
      let content = '';
      try {
        const r1 = await callOpenAI(model);
        data = r1.data;
        content = r1.content;
      } catch (e: any) {
        const status = e?.response?.status;
        const errMsg = e?.response?.data?.error?.message || e?.message || '';
        // Common fix: env points to a model not available on the account.
        // Retry once with a safe fallback.
        const looksLikeModelIssue = status === 400 && /model/i.test(String(errMsg));
        if (looksLikeModelIssue) {
          try {
            const fallbackModel = 'gpt-4o-mini';
            const r2 = await callOpenAI(fallbackModel);
            data = r2.data;
            content = r2.content;
          } catch (e2: any) {
            throw e2;
          }
        } else {
          throw e;
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
      };
      if (content) return { text: content, usage };
    } catch (e: any) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      console.warn(`[AI][openai] ${purpose} call failed:`, status || '', data?.error?.message || e?.message || e);
    }
  }
  return { text: '' };
}

export async function openaiRespond(input: string, model = 'gpt-5.1'): Promise<{ text: string; raw: any }> {
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
