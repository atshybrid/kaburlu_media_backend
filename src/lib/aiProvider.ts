import { AI_PROVIDER, AI_TIMEOUT_MS, GEMINI_KEY, OPENAI_KEY, DEFAULT_GEMINI_MODEL_SEO, DEFAULT_OPENAI_MODEL_SEO } from './aiConfig';

type AIPurpose = 'seo' | 'moderation' | 'translation' | 'rewrite' | 'shortnews_ai_article';

export async function aiGenerateText({ prompt }: { prompt: string; purpose: AIPurpose }): Promise<string> {
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
      if (text) return text;
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
      if (content) return content;
    } catch {}
  }
  return '';
}
