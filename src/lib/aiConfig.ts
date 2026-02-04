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
  // Default to OpenAI when available (faster for production)
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY) return 'gemini';
  return 'openai';
})();

export const AI_USE_GEMINI = parseBool(process.env.AI_USE_GEMINI, true);  // Enable Gemini by default when key exists
export const AI_USE_OPENAI = parseBool(process.env.AI_USE_OPENAI, true);  // Enable both providers
export const AI_PARALLEL_RACE = parseBool(process.env.AI_PARALLEL_RACE, false);  // Race both providers simultaneously for fastest response

// Feature flags (allow toggling without code changes)
export const AI_ENABLE_SEO = parseBool(process.env.AI_ENABLE_SEO, true);
export const AI_ENABLE_MODERATION = parseBool(process.env.AI_ENABLE_MODERATION, true);
export const AI_ENABLE_TRANSLATION = parseBool(process.env.AI_ENABLE_TRANSLATION, true);

export const GEMINI_KEY = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
export const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
export const OPENAI_KEY_FALLBACK = process.env.OPENAI_API_KEY_FALLBACK || '';

// Default Gemini model (can be overridden per-purpose)
const GEMINI_MODEL_FALLBACK = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';  // Ultra-fast lite version
export const DEFAULT_GEMINI_MODEL_SEO = process.env.GEMINI_MODEL_SEO || GEMINI_MODEL_FALLBACK;
export const DEFAULT_GEMINI_MODEL_MODERATION = process.env.GEMINI_MODEL_MODERATION || GEMINI_MODEL_FALLBACK;
export const DEFAULT_GEMINI_MODEL_TRANSLATION = process.env.GEMINI_MODEL_TRANSLATION || GEMINI_MODEL_FALLBACK;
// Prefer a faster model for rewrite-style tasks unless explicitly overridden
export const DEFAULT_GEMINI_MODEL_REWRITE = process.env.GEMINI_MODEL_REWRITE || GEMINI_MODEL_FALLBACK;

// SEO + rewrite are quality-sensitive; default to gpt-4o unless explicitly overridden.
export const DEFAULT_OPENAI_MODEL_SEO = process.env.OPENAI_MODEL_SEO || 'gpt-4o';
export const DEFAULT_OPENAI_MODEL_MODERATION = process.env.OPENAI_MODEL_MODERATION || 'gpt-4o-mini';
export const DEFAULT_OPENAI_MODEL_TRANSLATION = process.env.OPENAI_MODEL_TRANSLATION || 'gpt-4o-mini';
export const DEFAULT_OPENAI_MODEL_REWRITE = process.env.OPENAI_MODEL_REWRITE || 'gpt-4o';
// Used for newspaper/headline style generation (e.g., /ai/headlines)
export const DEFAULT_OPENAI_MODEL_NEWSPAPER = process.env.OPENAI_MODEL_NEWSPAPER || DEFAULT_OPENAI_MODEL_SEO;

export const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000);
// Optional: verify provider keys on startup (dev-safe; off by default)
export const AI_CHECK_KEYS_ON_STARTUP = parseBool(process.env.AI_CHECK_KEYS_ON_STARTUP, false);

// Basic generation defaults; individual callers can override
export const DEFAULT_TEMPERATURE = Number(process.env.AI_TEMPERATURE || 0.6);
export const DEFAULT_MAX_OUTPUT_TOKENS_REWRITE = Number(process.env.AI_MAX_OUTPUT_TOKENS_REWRITE || 4096);
export const DEFAULT_MAX_OUTPUT_TOKENS_DEFAULT = Number(process.env.AI_MAX_OUTPUT_TOKENS_DEFAULT || 2048);

export function aiEnabledFor(feature: 'seo' | 'moderation' | 'translation') {
  if (feature === 'seo') return AI_ENABLE_SEO;
  if (feature === 'moderation') return AI_ENABLE_MODERATION;
  if (feature === 'translation') return AI_ENABLE_TRANSLATION;
  return true;
}
