// Centralized AI configuration and feature flags

export type AIProvider = 'gemini' | 'openai';

function parseBool(v: string | undefined, def = false): boolean {
  if (!v) return def;
  const s = v.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === 'on';
}

export const AI_PROVIDER: AIProvider = (() => {
  const p = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (p === 'openai' || p === 'gemini') return p as AIProvider;
  // default to gemini if key exists, else openai if key exists
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'gemini';
})();

export const AI_USE_GEMINI = parseBool(process.env.AI_USE_GEMINI, true);
export const AI_USE_OPENAI = parseBool(process.env.AI_USE_OPENAI, false);

// Feature flags (allow toggling without code changes)
export const AI_ENABLE_SEO = parseBool(process.env.AI_ENABLE_SEO, true);
export const AI_ENABLE_MODERATION = parseBool(process.env.AI_ENABLE_MODERATION, true);
export const AI_ENABLE_TRANSLATION = parseBool(process.env.AI_ENABLE_TRANSLATION, true);

export const GEMINI_KEY = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
export const OPENAI_KEY = process.env.OPENAI_API_KEY || '';

export const DEFAULT_GEMINI_MODEL_SEO = process.env.GEMINI_MODEL_SEO || 'gemini-1.5-flash';
export const DEFAULT_GEMINI_MODEL_MODERATION = process.env.GEMINI_MODEL_MODERATION || 'gemini-1.5-flash';
export const DEFAULT_GEMINI_MODEL_TRANSLATION = process.env.GEMINI_MODEL_TRANSLATION || 'gemini-1.5-pro';
// Prefer a faster model for rewrite-style tasks unless explicitly overridden
export const DEFAULT_GEMINI_MODEL_REWRITE = process.env.GEMINI_MODEL_REWRITE || 'gemini-1.5-flash';

export const DEFAULT_OPENAI_MODEL_SEO = process.env.OPENAI_MODEL_SEO || 'gpt-4o-mini';
export const DEFAULT_OPENAI_MODEL_MODERATION = process.env.OPENAI_MODEL_MODERATION || 'gpt-4o-mini';
export const DEFAULT_OPENAI_MODEL_TRANSLATION = process.env.OPENAI_MODEL_TRANSLATION || 'gpt-4o-mini';
// Used for newspaper/headline style generation (e.g., /ai/headlines)
export const DEFAULT_OPENAI_MODEL_NEWSPAPER = process.env.OPENAI_MODEL_NEWSPAPER || DEFAULT_OPENAI_MODEL_SEO;

export const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 12000);

// Basic generation defaults; individual callers can override
export const DEFAULT_TEMPERATURE = Number(process.env.AI_TEMPERATURE || 0.6);
export const DEFAULT_MAX_OUTPUT_TOKENS_REWRITE = Number(process.env.AI_MAX_OUTPUT_TOKENS_REWRITE || 2048);
export const DEFAULT_MAX_OUTPUT_TOKENS_DEFAULT = Number(process.env.AI_MAX_OUTPUT_TOKENS_DEFAULT || 1024);

export function aiEnabledFor(feature: 'seo' | 'moderation' | 'translation') {
  if (feature === 'seo') return AI_ENABLE_SEO;
  if (feature === 'moderation') return AI_ENABLE_MODERATION;
  if (feature === 'translation') return AI_ENABLE_TRANSLATION;
  return true;
}
