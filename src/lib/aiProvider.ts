import { AI_PROVIDER, AI_TIMEOUT_MS, GEMINI_KEY, OPENAI_KEY, DEFAULT_GEMINI_MODEL_SEO, DEFAULT_OPENAI_MODEL_SEO } from './aiConfig';

type AIPurpose = 'seo' | 'moderation' | 'translation' | 'rewrite' | 'shortnews_ai_article' | 'newspaper';

export async function aiGenerateText({ prompt, purpose }: { prompt: string; purpose: AIPurpose }): Promise<{ text: string; usage?: any }> {
  const provider = AI_PROVIDER;
  if (provider === 'gemini' && GEMINI_KEY) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const modelName = DEFAULT_GEMINI_MODEL_SEO; // reuse for all purposes unless overridden via env
      const model = genAI.getGenerativeModel({ model: modelName });
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
      const res = await model.generateContent({ contents: [{ parts: [{ text: prompt }] }] }, { signal: ctrl.signal }).finally(() => clearTimeout(t));
      const text = res?.response?.text?.() || '';
      const usage = {
        provider: 'gemini',
        purpose,
        promptChars: prompt.length,
        responseChars: text.length,
      };
      if (text) return { text, usage };
    } catch {}
  }
  if (OPENAI_KEY) {
    try {
      // Lazy import to avoid bundling
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const axios = require('axios');
      const model = DEFAULT_OPENAI_MODEL_SEO;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400,
      }, {
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(t));
      const content = response?.data?.choices?.[0]?.message?.content || '';
      const usage = {
        provider: 'openai',
        purpose,
        prompt_tokens: response?.data?.usage?.prompt_tokens,
        completion_tokens: response?.data?.usage?.completion_tokens,
        total_tokens: response?.data?.usage?.total_tokens,
        promptChars: prompt.length,
        responseChars: content.length,
        model,
      };
      if (content) return { text: content, usage };
    } catch {}
  }
  return { text: '' };
}
