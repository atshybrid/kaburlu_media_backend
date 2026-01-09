# Render Environment Variables (Production)

Copy these EXACT variable names to Render Dashboard → Environment:

## Critical (App won't work without these)

```bash
# Database - Production (Neon)
DATABASE_URL=postgresql://kaburlu_prod:npg_6mVspRl5kOdN@ep-restless-dew-adbx2wnk-pooler.c-2.us-east-1.aws.neon.tech/Kaburlu_today?sslmode=require&pgbouncer=true

DATABASE_URL_DIRECT=postgresql://neondb_owner:npg_vr3aobATR4Gx@ep-restless-dew-adbx2wnk.c-2.us-east-1.aws.neon.tech/Kaburlu_today?sslmode=require
```

## Server Config

```bash
NODE_ENV=production
PORT=3001
BASE_URL=https://app.kaburlumedia.com
LOG_LEVEL=info
ENABLE_HTTP_LOGS=true
REQUEST_TIMEOUT_MS=30000
RATE_LIMIT_ENABLED=true
PRISMA_POOL_TIMEOUT=30
```

## CORS - Production

```bash
CORS_ALLOW_ALL=false
CORS_ORIGINS=https://app.kaburlumedia.com,https://admin.kaburlumedia.com,https://kaburlutoday.com,https://www.kaburlutoday.com
```

## App Config

```bash
MULTI_TENANCY=true
ALLOW_DESTRUCTIVE=false
```

## Auth - IMPORTANT: Generate new secrets!

```bash
# Generate new secrets with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=<generate-new-64-char-secret>
JWT_REFRESH_SECRET=<generate-new-64-char-secret>
JWT_EXPIRES_IN=8h
```

## AI - OpenAI (ChatGPT)

```bash
AI_PROVIDER=openai
AI_USE_OPENAI=true
AI_USE_GEMINI=false

AI_ENABLE_SEO=true
AI_ENABLE_MODERATION=true
AI_ENABLE_TRANSLATION=true
AI_TIMEOUT_MS=120000

OPENAI_MODEL_SEO=gpt-4o
OPENAI_MODEL_MODERATION=gpt-4o
OPENAI_MODEL_TRANSLATION=gpt-4o
OPENAI_MODEL_REWRITE=gpt-4o

OPENAI_API_KEY=<your-openai-api-key>
```

## Firebase

```bash
FIREBASE_PROJECT_ID=kaburlu-2f6de
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@kaburlu-2f6de.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=<paste-full-private-key-with-newlines>
FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase-credentials.json
```

## Cloudflare R2 (if using)

```bash
R2_ACCOUNT_ID=<your-account-id>
R2_ACCESS_KEY_ID=<your-access-key>
R2_SECRET_ACCESS_KEY=<your-secret-key>
R2_BUCKET=<your-bucket-name>
R2_PUBLIC_BASE_URL=https://your-bucket.r2.dev
```

## Media

```bash
MEDIA_MAX_IMAGE_MB=10
MEDIA_MAX_VIDEO_MB=100
MEDIA_PROVIDER=bunny
```

## Bunny CDN

```bash
BUNNY_STORAGE_ZONE_NAME=kaburlu-news
BUNNY_STORAGE_API_KEY=<your-bunny-storage-key>
BUNNY_STORAGE_PUBLIC_BASE_URL=kaburlu-news.b-cdn.net
BUNNY_STREAM_LIBRARY_ID=571138
BUNNY_STREAM_API_KEY=<your-bunny-stream-key>
```

## SEO

```bash
SEO_PUBLISHER_NAME=Kaburlu
SEO_PUBLISHER_LOGO=https://pub-b13a983e33694dbd96cd42158ce2147b.r2.dev/SEO_PUBLISHER_LOGO/2025/09/13/SEO_PUBLISHER_LOGO.png
SEO_PUBLISHER_LOGO_WIDTH=600
SEO_PUBLISHER_LOGO_HEIGHT=600
SLUG_REQUIRE_UNIQUE=true
```

## AI Prompts

```bash
AI_REWRITE_PROMPT_TRUE=ai_rewrite_prompt_true
AI_REWRITE_PROMPT_FALSE=ai_rewrite_prompt_false
```

## Tenant Defaults

```bash
DEFAULT_TENANT_REPORTER_ROLE_ID=cmit76wew0004ugdgzq8ubj98
```

## WhatsApp OTP

```bash
WHATSAPP_PHONE_NUMBER_ID=912129348647293
WHATSAPP_ACCESS_TOKEN=<your-whatsapp-access-token>
WHATSAPP_API_VERSION=v22.0
WHATSAPP_TEMPLATE_NAME=kaburlu_app_otp
WHATSAPP_OTP_TTL_MINUTES=10
WHATSAPP_OTP_ENABLED=true
WHATSAPP_OTP_TEMPLATE_LANG=en_US
WHATSAPP_SUPPORT_MOBILE=919347839987
```

---

## Important Notes:

1. **DO NOT copy-paste your local `.env` file to Render!**
2. **DO NOT include** `DB_PROFILE`, `DATABASE_URL_DEV`, `DATABASE_URL_PROD`, `DATABASE_URL_LOCAL` - Render only needs `DATABASE_URL` and `DATABASE_URL_DIRECT`
3. **Change all secrets** (JWT, API keys) before production
4. Use Render's "Env Groups" feature to organize these variables

## Quick Setup:

1. Go to Render Dashboard → Your Service → Environment
2. Click "Add Environment Variable"
3. Copy each variable from above (name and value)
4. Click "Save Changes" - Render will auto-redeploy
