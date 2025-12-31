import 'dotenv/config';

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
        seo: process.env.GEMINI_MODEL_SEO || 'gemini-1.5-flash',
        moderation: process.env.GEMINI_MODEL_MODERATION || 'gemini-1.5-flash',
        translation: process.env.GEMINI_MODEL_TRANSLATION || 'gemini-1.5-pro',
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
