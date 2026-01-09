# VS Code + Render Deployment Guide: Background Jobs & Cron

## 🎯 Overview

Your backend has **2 separate processes**:
1. **API Server** (`src/index.ts`) - handles HTTP requests
2. **AI Cron Job** (`src/jobs/aiQueue.cron.ts`) - background AI processing every 1 minute

---

## 💻 VS Code Development (Local)

### Option 1: Run Both in Separate Terminals (Recommended)

**Terminal 1 - API Server:**
```bash
npm run dev
# or
npm run start:dev
```

**Terminal 2 - AI Cron Job:**
```bash
npm run jobs:ai-cron
```

### Option 2: Use VS Code Tasks (Run Both at Once)

Already configured in `.vscode/tasks.json`:

**Run from VS Code:**
1. Press `Ctrl+Shift+P`
2. Type "Run Task"
3. Select **"Start Dev + AI Cron"**

This starts both processes in parallel automatically!

### How It Works Locally

- **API Server** (`localhost:3001`):
  - Handles all API requests
  - Swagger docs at `/api/docs`
  
- **AI Cron Job**:
  - Runs every 1 minute
  - Checks database for articles with `aiQueue: { web: true, short: true, newspaper: true }`
  - Processes AI rewrites in background
  - No HTTP server needed

---

## ☁️ Render Deployment (Production)

### Current Setup Issue
Your `render.yaml` only has **1 web service** — you need **2 services** for production.

### ✅ Best Practice: 2 Separate Render Services

#### Update `render.yaml`:

```yaml
services:
  # 1. Main API Server
  - type: web
    name: kaburlu-api
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    healthCheckPath: /health
    autoDeploy: true
    plan: starter  # or your plan
    envVars:
      - key: NODE_ENV
        value: production
      - key: PUPPETEER_EXECUTABLE_PATH
        value: /usr/bin/chromium
      - key: PUPPETEER_SKIP_DOWNLOAD
        value: 'true'
      - fromGroup: kaburlu-secrets  # your env var group

  # 2. Background AI Cron Worker (Runs every 1 minute)
  - type: worker
    name: kaburlu-ai-cron
    env: docker
    dockerfilePath: ./Dockerfile.worker
    dockerContext: .
    autoDeploy: true
    plan: starter
    envVars:
      - key: NODE_ENV
        value: production
      - fromGroup: kaburlu-secrets
```

#### Create `Dockerfile.worker` (for cron job):

```dockerfile
FROM node:20-slim

# Install Chromium dependencies (for Puppeteer if needed)
RUN apt-get update && apt-get install -y \\
    chromium \\
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \\
    --no-install-recommends && \\
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Run AI cron worker
CMD ["node", "dist/jobs/aiQueue.cron.js"]
```

---

## 🏗️ Alternative: Single Service with PM2 (Simpler)

If you want **1 Render service** running both processes:

### Update `Dockerfile` to use PM2:

```dockerfile
FROM node:20-slim

# Install Chromium + PM2
RUN apt-get update && apt-get install -y \\
    chromium \\
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \\
    --no-install-recommends && \\
    rm -rf /var/lib/apt/lists/* && \\
    npm install -g pm2

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

RUN npm ci --only=production
RUN npx prisma generate

COPY . .
RUN npm run build

# Copy PM2 config
COPY ecosystem.config.cjs ./

# Start both API + Cron with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
```

### Keep `render.yaml` simple:

```yaml
services:
  - type: web
    name: kaburlu-backend
    env: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    healthCheckPath: /health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - fromGroup: kaburlu-secrets
```

---

## 📊 Comparison: Which is Better?

| Approach | Pros | Cons | Cost |
|----------|------|------|------|
| **2 Services** (API + Worker) | ✅ Separate scaling<br>✅ Independent restarts<br>✅ Better monitoring | ❌ More complex setup<br>❌ 2 services to manage | 💰 2x service cost |
| **1 Service + PM2** | ✅ Simpler setup<br>✅ Single service<br>✅ PM2 auto-restart | ❌ Can't scale separately<br>❌ If one crashes, both restart | 💰 1x service cost |

**Recommendation for Production: 2 Services** (better reliability)

**For Small/Testing: 1 Service + PM2** (cheaper, simpler)

---

## 🔧 VS Code Tasks Explained

Your current `.vscode/tasks.json` has these tasks:

```json
{
  "label": "Start Dev Server",
  "command": "npm run start:dev"
  // Starts API only
}

{
  "label": "Start AI Queue Cron",
  "command": "npm run jobs:ai-cron"
  // Starts background cron only
}

{
  "label": "Start Dev + AI Cron",
  "dependsOn": ["Start Dev Server", "Start AI Queue Cron"]
  // Runs BOTH in parallel
}
```

**To use:**
- Press `Ctrl+Shift+B` → Build TypeScript
- Press `Ctrl+Shift+P` → "Tasks: Run Task" → "Start Dev + AI Cron"

---

## 🚀 Quick Start Guide

### Local Development (VS Code):

**Option A: Manual (2 terminals)**
```bash
# Terminal 1:
npm run dev

# Terminal 2:
npm run jobs:ai-cron
```

**Option B: VS Code Task (automatic)**
1. `Ctrl+Shift+P`
2. "Run Task"
3. "Start Dev + AI Cron"

### Production (Render):

**Best: 2 Services**
1. Create `Dockerfile.worker` (above)
2. Update `render.yaml` with both services
3. Push to Git
4. Render auto-deploys both services

**Simple: 1 Service + PM2**
1. Update `Dockerfile` to use PM2
2. Keep simple `render.yaml`
3. Push to Git
4. Single service runs both processes

---

## 🔍 Monitoring Background Jobs

### Check if Cron is Running:

**Local (VS Code Terminal):**
```bash
# You'll see logs every 1 minute:
[AI Queue Cron] Checking for pending AI rewrites...
[AI Queue Cron] Processing 5 articles...
```

**Production (Render):**
- Go to Render Dashboard
- Click your worker/service
- View "Logs" tab
- Should see cron output every minute

### Test Background Job:

**Create an article with AI queue:**
```bash
POST /api/v1/articles
{
  "title": "Test",
  "content": { "raw": {...}, "aiQueue": { "web": true } }
}
```

Wait 1 minute → Check logs → Should process automatically

---

## 📋 Production Checklist

- [ ] Build succeeds: `npm run build`
- [ ] Choose deployment approach (2 services or PM2)
- [ ] Update `Dockerfile` or create `Dockerfile.worker`
- [ ] Update `render.yaml`
- [ ] Set all env vars in Render dashboard
- [ ] Test health endpoint: `/health`
- [ ] Monitor logs for cron output
- [ ] Test AI rewrite flow end-to-end

---

## 🆘 Common Issues

**Issue: Cron not running on Render**
- ✅ Check service logs
- ✅ Verify `NODE_ENV=production`
- ✅ Ensure `DATABASE_URL` is set

**Issue: Both processes competing for port**
- ✅ Only API needs port
- ✅ Cron job has no HTTP server
- ✅ Use separate services or PM2

**Issue: VS Code task not starting both**
- ✅ Check `.vscode/tasks.json` exists
- ✅ Restart VS Code
- ✅ Run tasks manually first to debug
