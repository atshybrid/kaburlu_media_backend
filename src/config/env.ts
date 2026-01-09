import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

function loadEnvFile() {
  const explicit = process.env.ENV_FILE;
  const candidates = explicit
    ? [explicit]
    : [
        process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
        '.env',
      ];

  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate);
    if (fs.existsSync(resolved)) {
      dotenv.config({ path: resolved });
      if (candidate !== '.env') {
        console.log(`[Config] Loaded env file: ${candidate}`);
      }
      return;
    }
  }
}

function removeQueryParam(url: string, key: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete(key);
    return u.toString();
  } catch {
    // If URL parsing fails, do a best-effort string removal.
    const re = new RegExp(`([?&])${key}=[^&]*(&?)`, 'i');
    return url.replace(re, (m, sep, tail) => (sep === '?' && tail ? '?' : sep === '?' ? '' : tail ? '&' : ''));
  }
}

function deriveNeonDirectUrl(poolerUrl: string): string {
  // Neon pooler host contains "-pooler" in hostname. Direct URL must not use pooler,
  // and Prisma migrations should avoid PgBouncer hints.
  let direct = poolerUrl;
  try {
    const u = new URL(poolerUrl);
    u.hostname = u.hostname.replace(/-pooler(?=\.)/i, '');
    direct = u.toString();
  } catch {
    direct = poolerUrl.replace(/-pooler(?=\.)/i, '');
  }
  direct = removeQueryParam(direct, 'pgbouncer');
  return direct;
}

function applyDbProfileSelection() {
  const profileRaw = process.env.DB_PROFILE;
  const profile = profileRaw?.trim().toLowerCase();
  if (!profile) return;

  const profileKey = profile.toUpperCase();
  const urlKey = `DATABASE_URL_${profileKey}`;
  const directKey = `DATABASE_URL_DIRECT_${profileKey}`;
  const fallbackKey = `DATABASE_URL_FALLBACK_${profileKey}`;

  const profileUrl = process.env[urlKey];
  const profileDirectUrl = process.env[directKey];
  const profileFallbackUrl = process.env[fallbackKey];

  if (!profileUrl && !process.env.DATABASE_URL) {
    console.warn(
      `[Config] DB_PROFILE=${profile} is set but ${urlKey} is missing (and DATABASE_URL is not set).`
    );
  } else if (!profileUrl) {
    console.warn(`[Config] DB_PROFILE=${profile} is set but ${urlKey} is missing. Using existing DATABASE_URL.`);
  }

  if (profileUrl) {
    process.env.DATABASE_URL = profileUrl;
  }
  if (profileDirectUrl) {
    process.env.DATABASE_URL_DIRECT = profileDirectUrl;
  }
  if (profileFallbackUrl) {
    process.env.DATABASE_URL_FALLBACK = profileFallbackUrl;
  }

  // If a profile URL is pooler-based and DIRECT isn't provided, derive a direct URL.
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL_DIRECT) {
    const url = process.env.DATABASE_URL;
    if (/-pooler(?=\.)/i.test(url)) {
      process.env.DATABASE_URL_DIRECT = deriveNeonDirectUrl(url);
    }
  }

  console.log(`[Config] DB_PROFILE=${profile}`);
}

// Load env as early as possible, then apply DB profile selection.
loadEnvFile();
applyDbProfileSelection();

// Centralized environment + validation
// Minimal lightweight validation (no extra deps) to avoid runtime surprises.

function requireString(key: string, optional = false): string | undefined {
  const v = process.env[key];
  if (!v && !optional) throw new Error(`Missing required environment variable: ${key}`);
  return v;
}

function parseBool(val: string | undefined, def: boolean): boolean {
  if (val == null) return def;
  return /^(1|true|yes|on)$/i.test(val);
}

function parseIntSafe(val: string | undefined, def: number): number {
  if (!val) return def;
  const n = Number(val);
  return Number.isFinite(n) ? n : def;
}

// Normalize multiline private key if present
function normalizePrivateKey(pk: string | undefined): string | undefined {
  if (!pk) return pk;
  // Remove surrounding quotes if accidentally included
  const trimmed = pk.trim().replace(/^"|"$/g, '');
  return trimmed.replace(/\\n/g, '\n');
}

const NODE_ENV = process.env.NODE_ENV || 'development';
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';

export const config = {
  env: NODE_ENV,
  isProd: NODE_ENV === 'production',
  port: parseIntSafe(process.env.PORT, 3001),

  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    accessSecret: requireString('JWT_SECRET', true) || 'dev-secret-change-me',
    refreshSecret: requireString('JWT_REFRESH_SECRET', true) || 'dev-refresh-secret-change-me',
  },

  ai: {
    provider: AI_PROVIDER,
    useGemini: parseBool(process.env.AI_USE_GEMINI, AI_PROVIDER === 'gemini'),
    useOpenAI: parseBool(process.env.AI_USE_OPENAI, AI_PROVIDER === 'openai'),
    enableSEO: parseBool(process.env.AI_ENABLE_SEO, true),
    enableModeration: parseBool(process.env.AI_ENABLE_MODERATION, true),
    enableTranslation: parseBool(process.env.AI_ENABLE_TRANSLATION, true),
    timeoutMs: parseIntSafe(process.env.AI_TIMEOUT_MS, 12000),
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      models: {
        seo: process.env.GEMINI_MODEL_SEO || 'gemini-2.0-flash',
        moderation: process.env.GEMINI_MODEL_MODERATION || 'gemini-2.0-flash',
        translation: process.env.GEMINI_MODEL_TRANSLATION || 'gemini-2.0-flash',
      }
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      models: {
        seo: process.env.OPENAI_MODEL_SEO || 'gpt-4o-mini',
        moderation: process.env.OPENAI_MODEL_MODERATION || 'gpt-4o-mini',
        translation: process.env.OPENAI_MODEL_TRANSLATION || 'gpt-4o-mini',
      }
    }
  },

  firebase: {
    credsPath: process.env.FIREBASE_CREDENTIALS_PATH,
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    translateApiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    endpoint: process.env.R2_ENDPOINT,
  },

  media: {
    provider: (process.env.MEDIA_PROVIDER || 'r2').toLowerCase(),
    bunny: {
      storage: {
        zoneName: process.env.BUNNY_STORAGE_ZONE_NAME,
        apiKey: process.env.BUNNY_STORAGE_API_KEY,
        publicBaseUrl: process.env.BUNNY_STORAGE_PUBLIC_BASE_URL,
      },
      stream: {
        libraryId: process.env.BUNNY_STREAM_LIBRARY_ID,
        apiKey: process.env.BUNNY_STREAM_API_KEY,
        // Default embed base URL for playback.
        embedBaseUrl: process.env.BUNNY_STREAM_EMBED_BASE_URL || 'https://iframe.mediadelivery.net/embed',
      },
    },
  },

  seo: {
    publisherName: process.env.SEO_PUBLISHER_NAME || 'Kaburlu',
    publisherLogo: process.env.SEO_PUBLISHER_LOGO,
    publisherLogoWidth: parseIntSafe(process.env.SEO_PUBLISHER_LOGO_WIDTH, 600),
    publisherLogoHeight: parseIntSafe(process.env.SEO_PUBLISHER_LOGO_HEIGHT, 60),
  },

  slug: {
    requireUnique: parseBool(process.env.SLUG_REQUIRE_UNIQUE, true),
  },

  whatsapp: {
    enabled: parseBool(process.env.WHATSAPP_OTP_ENABLED, false),
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91',
    otpTemplateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'kaburlu_app_otp',
    otpTemplateLang: process.env.WHATSAPP_OTP_TEMPLATE_LANG || 'en_US',
    supportMobile: process.env.WHATSAPP_SUPPORT_MOBILE || '',
    ttlText: process.env.WHATSAPP_OTP_TTL_TEXT || '10 minutes',
  },
};

// Soft warnings for critical secrets in production
if (config.isProd) {
  const weak: string[] = [];
  if (config.jwt.accessSecret?.includes('dev-secret')) weak.push('JWT_SECRET');
  if (config.jwt.refreshSecret?.includes('dev-refresh')) weak.push('JWT_REFRESH_SECRET');
  if (weak.length) {
    console.warn('[Config] Weak production secrets detected:', weak.join(', '));
  }
}

export type AppConfig = typeof config;
