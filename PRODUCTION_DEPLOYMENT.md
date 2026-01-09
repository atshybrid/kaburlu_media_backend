# Production Deployment Guide - Kaburlu Media Backend

## ✅ Completed Setup

### Database
- [x] Production DB: `Kaburlu_today` on Neon
- [x] All 78 migrations applied successfully
- [x] Core seed data loaded:
  - 14 roles
  - 12 reporter designations
  - 13 languages
  - 36 Indian states
  - 33 Telangana districts
  - 120 assembly constituencies
  - **52 categories** (16 general + 36 state-specific)
  - **28 kin relations** (family tree)
  - **9 ePaper block templates**
  - 2 AI prompts
  - 2 demo users

### Configuration
- [x] Multi-tenancy enabled (`MULTI_TENANCY=true`)
- [x] Dev/Prod DB switching via `DB_PROFILE`
- [x] AI switched to OpenAI only (Gemini removed)
- [x] TypeScript build successful
- [x] PM2 config ready

---

## 🚨 CRITICAL: Security Fixes Required BEFORE Production

### 1. **Change JWT Secrets** (URGENT)
```env
# Current (INSECURE):
JWT_SECRET=thisissecret
JWT_REFRESH_SECRET=please-change-to-a-strong-random-string

# Generate strong secrets:
# Run in PowerShell:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Then update .env:
JWT_SECRET=<generated-64-char-hex>
JWT_REFRESH_SECRET=<generated-64-char-hex>
```

### 2. **Lock Down CORS** (URGENT)
```env
# Current (allows ALL origins - dangerous):
CORS_ALLOW_ALL=true

# Production fix:
CORS_ALLOW_ALL=false
CORS_ORIGINS=https://app.kaburlumedia.com,https://admin.kaburlumedia.com,https://yourdomain.com
```

### 3. **Update BASE_URL**
```env
# Current:
BASE_URL=http://localhost:3000

# Production:
BASE_URL=https://api.kaburlumedia.com
# or your actual production API domain
```

### 4. **Set Production DB Password** (Recommended)
- Your current DB password is exposed in this `.env` file
- **After production launch:**
  1. Rotate Neon database password in Neon dashboard
  2. Update `DATABASE_URL` and `DATABASE_URL_PROD` with new password
  3. Do NOT commit `.env` to Git

### 5. **Rotate API Keys** (After Deployment)
The following keys are exposed and should be rotated:
- OpenAI API key
- Firebase private key
- R2 credentials
- Bunny CDN keys
- WhatsApp access token

---

## 📋 Production Deployment Steps

### Step 1: Create Production `.env` File
```bash
# Copy current .env as template
cp .env .env.production

# Edit .env.production and apply security fixes above
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Build TypeScript
```bash
npm run build
```

### Step 4: Run Database Migrations (Production)
```bash
# Using .env.production file:
npm run prisma:migrate:deploy:prod:env

# OR set DB_PROFILE=prod in .env and run:
npm run prisma:migrate:deploy
```

### Step 5: Seed Production Data (if needed)
```bash
# Main seed (roles, languages, states, etc.):
npm run seed

# Additional seeds:
npx ts-node scripts/seed_comprehensive_categories.ts
npx ts-node scripts/seed_kin_relations.ts
npx ts-node scripts/seed_epaper_block_templates.ts
```

### Step 6: Start Production Server

**Option A: Direct Node (simple)**
```bash
npm run build
npm run start
```

**Option B: PM2 (recommended for production)**
```bash
npm run prod:pm2:start
# Or manually:
npm run build
npx pm2 start ecosystem.config.cjs
npx pm2 save
npx pm2 startup  # (run the command it gives you)
```

**Option C: With specific env file**
```bash
npm run start:prod:env  # uses .env.production
```

### Step 7: Verify Deployment
```bash
# Check PM2 status:
npx pm2 list

# View logs:
npx pm2 logs

# Test API:
curl https://your-api-domain.com/health
```

---

## 🔄 Dev/Prod Switching (Easy Management)

### Current Setup
You have **3 database profiles** configured:

1. **Local** (`DB_PROFILE=local`) - Docker Postgres
2. **Dev** (`DB_PROFILE=dev`) - Neon `kaburlu_dev` database
3. **Prod** (`DB_PROFILE=prod`) - Neon `Kaburlu_today` database

### Switch Databases
Just change `DB_PROFILE` in `.env`:
```env
# For production:
DB_PROFILE=prod

# For development:
DB_PROFILE=dev

# For local testing:
DB_PROFILE=local
```

### Run Migrations Per Environment
```bash
# Dev migrations:
npm run prisma:migrate:dev:env

# Prod migrations:
npm run prisma:migrate:deploy:prod:env
```

---

## 🏗️ Multi-Tenant Production Checklist

### Required for Each Tenant

#### 1. Create Tenant (via API or seed script)
```typescript
POST /api/v1/tenants
{
  "name": "Tenant Name",
  "slug": "tenant-slug",
  "status": "ACTIVE"
}
```

#### 2. Create Domain
```typescript
POST /api/v1/domains
{
  "domain": "app.tenantdomain.com",
  "tenantId": "<tenant-id>",
  "isPrimary": true
}
```

#### 3. Assign Languages
```typescript
POST /api/v1/domains/:domainId/languages
{
  "languageId": "<language-id>"
}
```

#### 4. Assign Categories
```typescript
POST /api/v1/domains/:domainId/categories
{
  "categoryId": "<category-id>"
}
```

#### 5. Create TenantEntity (Business Info)
```typescript
POST /api/v1/tenants/:tenantId/entity
{
  "legalName": "Company Legal Name",
  "businessType": "MEDIA",
  // ... other fields
}
```

#### 6. Configure Theme & Settings
- Set TenantTheme (homepage config)
- Set TenantSettings (ads config)
- Set EntitySettings (social links, contact)

---

## 📊 Monitoring & Maintenance

### PM2 Commands
```bash
# View status:
pm2 list

# View logs:
pm2 logs kaburlu-api
pm2 logs kaburlu-ai-cron

# Restart:
pm2 restart kaburlu-api

# Stop:
pm2 stop all

# Monitor:
pm2 monit
```

### Database Backup (Recommended)
```bash
# Neon automatic backups (check Neon dashboard)
# Manual backup:
pg_dump <DATABASE_URL> > backup-$(date +%Y%m%d).sql
```

### Health Checks
- API: `GET /health`
- Swagger: `GET /api/docs`
- Database connection: automatic on startup

---

## 🚀 Quick Production Start (After Security Fixes)

```bash
# 1. Fix security (JWT, CORS, BASE_URL above)
# 2. Install & build:
npm install
npm run build

# 3. Start with PM2:
npm run prod:pm2:start

# 4. Check status:
npx pm2 list
npx pm2 logs

# 5. Test:
curl https://your-api-domain.com/health
```

---

## 🔐 Post-Deployment Security

1. **Rotate all exposed secrets** in this `.env` file
2. **Never commit** `.env` or `.env.production` to Git
3. **Use environment variables** in your hosting platform (Render, Railway, etc.)
4. **Enable rate limiting** (already enabled: `RATE_LIMIT_ENABLED=true`)
5. **Monitor logs** for suspicious activity

---

## 📝 Environment Variables Checklist

### Required for Production
- [x] `DATABASE_URL` (Neon pooler)
- [x] `DATABASE_URL_DIRECT` (Neon direct for migrations)
- [ ] `JWT_SECRET` (CHANGE THIS!)
- [ ] `JWT_REFRESH_SECRET` (CHANGE THIS!)
- [ ] `BASE_URL` (your production domain)
- [ ] `CORS_ORIGINS` (your frontend domains)
- [x] `MULTI_TENANCY=true`
- [x] `NODE_ENV=production`
- [x] `AI_PROVIDER=openai`
- [x] `OPENAI_API_KEY`

### Optional but Recommended
- [x] `FIREBASE_CREDENTIALS_PATH` (or use JSON in env var)
- [x] `R2_*` or `BUNNY_*` (media storage)
- [x] `WHATSAPP_*` (OTP integration)
- [ ] `SENTRY_DSN` (error tracking - add if needed)

---

## 📞 Support & Documentation

- API Docs: `/api/docs` (Swagger)
- Frontend Integration: `FRONTEND_NEXTJS_INTEGRATION.md`
- Preferences API: `PREFERENCES_API.md`
- Website API: `WEBSITE_API.md`
- Main README: `README.md`
