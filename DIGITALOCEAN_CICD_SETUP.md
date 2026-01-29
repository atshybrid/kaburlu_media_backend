# DigitalOcean CI/CD Setup Guide

## 🎯 Overview

This guide sets up automatic deployment from GitHub to DigitalOcean Droplet.

**Flow:**
```
Git Push → GitHub Actions → SSH to Droplet → Pull & Restart PM2
```

---

## 📋 Prerequisites

| Item | Description |
|------|-------------|
| DigitalOcean Droplet | Ubuntu 22.04+ recommended |
| GitHub Repository | Your backend code |
| Domain (optional) | For SSL/HTTPS |

---

## 🖥️ STEP 1: Droplet Initial Setup

### 1.1 Connect to Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

### 1.2 Create Deploy User (Recommended)

```bash
# Create user
adduser deploy
usermod -aG sudo deploy

# Setup SSH for deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### 1.3 Install Node.js (v20 LTS)

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install Node.js
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node -v  # Should show v20.x.x
npm -v
```

### 1.4 Install PM2 (Process Manager)

```bash
npm install -g pm2

# Enable PM2 startup on reboot
pm2 startup
# Copy and run the command it outputs
```

### 1.5 Install Git

```bash
apt update
apt install git -y
git --version
```

### 1.6 Install PostgreSQL Client (for Prisma)

```bash
apt install postgresql-client -y
```

---

## 📁 STEP 2: Project Setup on Droplet

### 2.1 Clone Repository

```bash
# Switch to deploy user
su - deploy

# Create app directory
mkdir -p /home/deploy/apps
cd /home/deploy/apps

# Clone repo
git clone https://github.com/YOUR_USERNAME/kaburlu_media_backend.git
cd kaburlu_media_backend
```

### 2.2 Install Dependencies

```bash
npm install
```

### 2.3 Create .env File

```bash
nano .env
```

Add your production environment variables:

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Server
PORT=3001
NODE_ENV=production

# Skip seed on startup (production)
SKIP_SEED=true

# AI (optional)
OPENAI_API_KEY=sk-xxx
GEMINI_API_KEY=xxx

# R2 Storage (optional)
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=xxx
```

### 2.4 Build & Generate Prisma

```bash
npm run prisma:generate
npm run build
```

### 2.5 Run Database Migrations

```bash
npm run prisma:migrate:deploy
```

### 2.6 Start with PM2

```bash
pm2 start dist/index.js --name "kaburlu-api"
pm2 save
```

### 2.7 Verify Running

```bash
pm2 status
pm2 logs kaburlu-api --lines 50
```

---

## 🔐 STEP 3: GitHub Actions Setup

### 3.1 Generate SSH Key for GitHub

On your **LOCAL machine**:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key
```

### 3.2 Add Public Key to Droplet

```bash
# Copy public key
cat ~/.ssh/github_deploy_key.pub

# On Droplet, add to deploy user's authorized_keys
nano /home/deploy/.ssh/authorized_keys
# Paste the public key
```

### 3.3 Add Secrets to GitHub Repository

Go to: **GitHub Repo → Settings → Secrets and variables → Actions**

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `DROPLET_HOST` | Your Droplet IP (e.g., `165.232.xxx.xxx`) |
| `DROPLET_USER` | `deploy` |
| `DROPLET_SSH_KEY` | Contents of `~/.ssh/github_deploy_key` (private key) |
| `DROPLET_PATH` | `/home/deploy/apps/kaburlu_media_backend` |

### 3.4 Create GitHub Actions Workflow

Create file: `.github/workflows/deploy.yml`

```yaml
name: Deploy to DigitalOcean

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Droplet
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DROPLET_HOST }}
          username: ${{ secrets.DROPLET_USER }}
          key: ${{ secrets.DROPLET_SSH_KEY }}
          script: |
            cd ${{ secrets.DROPLET_PATH }}
            
            # Pull latest code
            git fetch origin main
            git reset --hard origin/main
            
            # Install dependencies
            npm install --production=false
            
            # Generate Prisma client
            npm run prisma:generate
            
            # Build TypeScript
            npm run build
            
            # Run migrations (if any)
            npm run prisma:migrate:deploy || true
            
            # Restart PM2
            pm2 restart kaburlu-api --update-env
            
            # Save PM2 state
            pm2 save
            
            echo "✅ Deployment complete!"
```

---

## 🔄 STEP 4: Cron Jobs Setup (Optional)

### 4.1 Location AI Cron Job

If you need to run periodic AI location processing:

```bash
# Edit crontab
crontab -e

# Add cron job (runs every 6 hours)
0 */6 * * * cd /home/deploy/apps/kaburlu_media_backend && /home/deploy/.nvm/versions/node/v20.x.x/bin/node dist/scripts/locationCron.js >> /home/deploy/logs/location-cron.log 2>&1
```

### 4.2 Create Logs Directory

```bash
mkdir -p /home/deploy/logs
```

### 4.3 Common Cron Patterns

| Pattern | Description |
|---------|-------------|
| `0 * * * *` | Every hour |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * *` | Daily at midnight |
| `*/15 * * * *` | Every 15 minutes |
| `0 2 * * 0` | Weekly (Sunday 2 AM) |

### 4.4 View Cron Logs

```bash
tail -f /home/deploy/logs/location-cron.log
```

---

## 🌐 STEP 5: Nginx Reverse Proxy (Recommended)

### 5.1 Install Nginx

```bash
apt install nginx -y
```

### 5.2 Create Nginx Config

```bash
nano /etc/nginx/sites-available/kaburlu-api
```

Add:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;  # Or use Droplet IP

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.3 Enable Site

```bash
ln -s /etc/nginx/sites-available/kaburlu-api /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### 5.4 Setup SSL with Certbot (Free HTTPS)

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d api.yourdomain.com
```

---

## 🔥 STEP 6: Firewall Setup

```bash
# Enable UFW
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable

# Verify
ufw status
```

---

## 📊 STEP 7: Monitoring Commands

### PM2 Commands

```bash
# Status
pm2 status

# Logs
pm2 logs kaburlu-api

# Restart
pm2 restart kaburlu-api

# Stop
pm2 stop kaburlu-api

# Delete
pm2 delete kaburlu-api

# Monitor (real-time)
pm2 monit
```

### Check Disk Space

```bash
df -h
```

### Check Memory

```bash
free -m
```

### Check Running Processes

```bash
htop
```

---

## 🚨 Troubleshooting

### Issue: PM2 not found after reboot

```bash
# Re-run startup command
pm2 startup
pm2 save
```

### Issue: Node not found

```bash
# Reload NVM
source ~/.bashrc
nvm use 20
```

### Issue: Permission denied on git pull

```bash
# Fix ownership
chown -R deploy:deploy /home/deploy/apps/kaburlu_media_backend
```

### Issue: Port 3001 already in use

```bash
# Find and kill process
lsof -i :3001
kill -9 <PID>
pm2 restart kaburlu-api
```

### Issue: Database connection failed

```bash
# Test connection
psql "postgresql://user:pass@host:5432/dbname?sslmode=require"
```

---

## ✅ Deployment Checklist

- [ ] Droplet created with Ubuntu 22.04+
- [ ] Node.js 20 installed via NVM
- [ ] PM2 installed globally
- [ ] Git installed
- [ ] Repository cloned
- [ ] .env file created with production values
- [ ] npm install completed
- [ ] Prisma generated
- [ ] Build completed
- [ ] Migrations deployed
- [ ] PM2 started and saved
- [ ] GitHub Secrets configured
- [ ] GitHub Actions workflow created
- [ ] SSH key added to Droplet
- [ ] Nginx configured (optional)
- [ ] SSL configured (optional)
- [ ] Firewall configured
- [ ] Cron jobs configured (if needed)

---

## 🎉 Success!

After setup, every push to `main` will:
1. Trigger GitHub Actions
2. SSH into your Droplet
3. Pull latest code
4. Install dependencies
5. Build TypeScript
6. Run migrations
7. Restart PM2

**Test your deployment:**
```bash
git add .
git commit -m "Test CI/CD"
git push
```

Watch the deployment: **GitHub → Actions tab**

---

## 📞 Quick Reference

| Command | Description |
|---------|-------------|
| `pm2 restart kaburlu-api` | Restart app |
| `pm2 logs kaburlu-api` | View logs |
| `pm2 status` | Check status |
| `cd /home/deploy/apps/kaburlu_media_backend && git pull` | Manual pull |
| `npm run build` | Rebuild |
| `npm run prisma:migrate:deploy` | Run migrations |
