import { AI_CHECK_KEYS_ON_STARTUP, AI_USE_GEMINI, AI_USE_OPENAI, OPENAI_KEY, GEMINI_KEY, DEFAULT_OPENAI_MODEL_SEO, DEFAULT_GEMINI_MODEL_SEO, AI_TIMEOUT_MS } from './aiConfig';

type ProviderStatus = {
  provider: 'openai' | 'gemini';
  keyPresent: boolean;
  reachable?: boolean;
  model?: string;
  error?: string;
  skipped?: boolean;
};

async function checkOpenAI(): Promise<ProviderStatus> {
  const status: ProviderStatus = { provider: 'openai', keyPresent: !!OPENAI_KEY, model: DEFAULT_OPENAI_MODEL_SEO };
  if (!OPENAI_KEY) return status;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const axios = require('axios');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), Math.min(AI_TIMEOUT_MS, 4000));
    await axios.post('https://api.openai.com/v1/chat/completions', {
      model: DEFAULT_OPENAI_MODEL_SEO,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say OK' }
      ],
      temperature: 0,
      max_tokens: 1,
    }, {
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
    status.reachable = true;
  } catch (e: any) {
    status.reachable = false;
    status.error = e?.response?.data?.error?.message || e?.message || String(e);
  }
  return status;
}

async function checkGemini(): Promise<ProviderStatus> {
  const status: ProviderStatus = { provider: 'gemini', keyPresent: !!GEMINI_KEY, model: DEFAULT_GEMINI_MODEL_SEO };
  // Skip Gemini check if AI_USE_GEMINI is false
  if (!AI_USE_GEMINI) {
    status.skipped = true;
    return status;
  }
  if (!GEMINI_KEY) return status;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL_SEO });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), Math.min(AI_TIMEOUT_MS, 4000));
    await model.generateContent({ contents: [{ parts: [{ text: 'OK' }] }] }, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    status.reachable = true;
  } catch (e: any) {
    status.reachable = false;
    status.error = e?.message || String(e);
  }
  return status;
}

export async function runAIStartupDiagnostics(): Promise<void> {
  if (!AI_CHECK_KEYS_ON_STARTUP) return;
  try {
    const results: ProviderStatus[] = [];
    
    // Only check OpenAI if enabled
    if (AI_USE_OPENAI) {
      results.push(await checkOpenAI());
    }
    
    // Only check Gemini if enabled
    if (AI_USE_GEMINI) {
      results.push(await checkGemini());
    }
    
    const summarize = (s: ProviderStatus) => {
      if (s.skipped) return `[AI][diag] ${s.provider} skipped (disabled)`;
      const base = `[AI][diag] ${s.provider} key=${s.keyPresent ? 'present' : 'missing'} model=${s.model ?? '-'} reachable=${s.reachable === true ? 'yes' : s.reachable === false ? 'no' : 'n/a'}`;
      if (s.error) return `${base} error="${s.error}"`;
      return base;
    };
    
    results.forEach(r => console.log(summarize(r)));
  } catch (e) {
    console.warn('[AI][diag] startup diagnostics error:', e);
  }
}

export async function pingAIProviders(): Promise<{ openai: ProviderStatus; gemini: ProviderStatus }> {
  const [openai, gemini] = await Promise.all([checkOpenAI(), checkGemini()]);
  return { openai, gemini };
}
