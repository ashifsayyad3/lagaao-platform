# lagaao.com — Hostinger Node.js Deployment Guide

This guide covers deploying the full lagaao.com monorepo to **Hostinger's Node.js hosting** (Business or Cloud plan) with a managed MySQL database, a custom domain, and automated CI/CD via GitHub Actions.

---

## Architecture on Hostinger

```
Internet
  │
  ▼
lagaao.com (DNS → Hostinger IP)
  │
  ▼
Hostinger Node.js Process (PM2)
  ├─ API Gateway         :4000  ← public-facing, proxied by Apache/Nginx
  ├─ Auth Service        :4001  ← internal only
  ├─ Product Service     :4002  ← internal only
  ├─ Cart Service        :4003  ← internal only
  ├─ Order Service       :4004  ← internal only
  └─ Payment Service     :4005  ← internal only

  Next.js frontend       :3000  ← proxied by Apache/Nginx

Hostinger MySQL 8        :3306  ← managed, same datacenter
Hostinger Redis (optional) — use Upstash free tier if not included
```

> Hostinger Business/Cloud plans allow multiple Node.js processes via PM2.
> All microservices run on the **same VPS**. The API Gateway is the only port
> exposed publicly (via the reverse proxy).

---

## Prerequisites

- [ ] Hostinger Business or Cloud hosting plan (Node.js support)
- [ ] Domain `lagaao.com` registered (at Hostinger or transferred)
- [ ] GitHub repository for the monorepo
- [ ] SSH access enabled in Hostinger hPanel → Advanced → SSH Access
- [ ] Razorpay account (test keys for staging, live keys for production)
- [ ] Cloudinary account for product image storage

---

## Step 1 — Prepare the GitHub Repository

### 1.1 Initialise git and push

```bash
# In the monorepo root
git init
git add .
git commit -m "chore: initial commit"

# Create a new repo at github.com/YOUR_ORG/lagaao-platform
git remote add origin https://github.com/YOUR_ORG/lagaao-platform.git
git branch -M main
git push -u origin main
```

### 1.2 Protect the main branch

In GitHub → Settings → Branches → Add rule:
- Branch name pattern: `main`
- ✅ Require pull request reviews before merging
- ✅ Require status checks to pass (add the CI job once created)

---

## Step 2 — Hostinger hPanel Setup

### 2.1 Enable SSH access

1. Log into **hPanel** → your hosting plan
2. Navigate to **Advanced → SSH Access**
3. Enable SSH, note your SSH username and hostname (e.g. `u123456789@147.x.x.x`)
4. Upload your public SSH key **or** set a password

### 2.2 Create MySQL database

1. hPanel → **Databases → MySQL Databases**
2. Create database: `lagaao_db`
3. Create user: `lagaao_user` with a strong password
4. Grant **all privileges** on `lagaao_db` to `lagaao_user`
5. Note the internal hostname — on Hostinger it's usually `localhost` or
   `127.0.0.1` (services run on the same server)

> ⚠️ External MySQL access is disabled on shared hosting. Use `127.0.0.1:3306`
> in all `DATABASE_URL` values.

### 2.3 Set up Node.js application

1. hPanel → **Node.js** (under Website section)
2. Click **Create application**
3. Set:
   - **Node.js version**: `20.x`
   - **Application root**: `/home/u123456789/lagaao-platform`  
     *(replace `u123456789` with your actual username)*
   - **Application URL**: `lagaao.com`
   - **Application startup file**: `ecosystem.config.cjs`
4. Click **Create**

---

## Step 3 — Environment Variables in hPanel

### 3.1 Using hPanel environment variable UI

1. hPanel → **Node.js** → your app → **Environment Variables**
2. Add each variable below one by one:

```
# ── Core ─────────────────────────────────────────────────────────────────────
NODE_ENV                    production

# ── Database (Hostinger MySQL — internal hostname) ────────────────────────────
DATABASE_URL                mysql://lagaao_user:YOUR_DB_PASS@127.0.0.1:3306/lagaao_db
DATABASE_HOST               127.0.0.1
DATABASE_PORT               3306
DATABASE_NAME               lagaao_db
DATABASE_USER               lagaao_user
DATABASE_PASSWORD           YOUR_STRONG_DB_PASSWORD

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET                  <generate: openssl rand -hex 32>
JWT_EXPIRES_IN              7d
JWT_REFRESH_SECRET          <generate: openssl rand -hex 32>
JWT_REFRESH_EXPIRES_IN      30d

# ── Redis (Upstash free tier — redis://default:token@host:port) ───────────────
REDIS_HOST                  YOUR_UPSTASH_HOST.upstash.io
REDIS_PORT                  6379
REDIS_PASSWORD              YOUR_UPSTASH_PASSWORD

# ── Service ports (internal, not exposed publicly) ────────────────────────────
API_GATEWAY_PORT            4000
AUTH_SERVICE_PORT           4001
PRODUCT_SERVICE_PORT        4002
CART_SERVICE_PORT           4003
ORDER_SERVICE_PORT          4004
PAYMENT_SERVICE_PORT        4005

# ── Service URLs used by the gateway ─────────────────────────────────────────
AUTH_SERVICE_URL            http://127.0.0.1:4001
PRODUCT_SERVICE_URL         http://127.0.0.1:4002
CART_SERVICE_URL            http://127.0.0.1:4003
ORDER_SERVICE_URL           http://127.0.0.1:4004
PAYMENT_SERVICE_URL         http://127.0.0.1:4005

# ── Frontend ──────────────────────────────────────────────────────────────────
FRONTEND_URL                https://lagaao.com
NEXT_PUBLIC_API_URL         https://lagaao.com/api
NEXT_PUBLIC_SITE_URL        https://lagaao.com
CORS_ORIGINS                https://lagaao.com,https://www.lagaao.com

# ── Razorpay ──────────────────────────────────────────────────────────────────
RAZORPAY_KEY_ID             rzp_live_XXXXXXXXXXXX
RAZORPAY_KEY_SECRET         YOUR_RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET     YOUR_RAZORPAY_WEBHOOK_SECRET

# ── Cloudinary ────────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME       YOUR_CLOUD_NAME
CLOUDINARY_API_KEY          YOUR_API_KEY
CLOUDINARY_API_SECRET       YOUR_API_SECRET

# ── Rate limiting ─────────────────────────────────────────────────────────────
THROTTLE_TTL                60
THROTTLE_LIMIT              100

# ── Email (optional) ──────────────────────────────────────────────────────────
SMTP_HOST                   smtp.sendgrid.net
SMTP_PORT                   587
SMTP_USER                   apikey
SMTP_PASS                   YOUR_SENDGRID_KEY
SMTP_FROM                   noreply@lagaao.com
```

> **Tip:** You can also SSH in and create `/home/u123456789/lagaao-platform/.env`
> with these values — PM2 will load it automatically.

---

## Step 4 — PM2 Ecosystem File

Create `ecosystem.config.cjs` in the monorepo root. This file tells PM2 how to
start every process.

> This file is already committed to the repo. Hostinger's Node.js panel reads
> it as the application startup file.

```js
// ecosystem.config.cjs  (in repo root — committed to git)
module.exports = {
  apps: [
    {
      name: 'lagaao-gateway',
      script: 'backend/api-gateway/dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      error_file: 'logs/gateway-error.log',
      out_file:   'logs/gateway-out.log',
    },
    {
      name: 'lagaao-auth',
      script: 'backend/services/auth-service/dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      error_file: 'logs/auth-error.log',
      out_file:   'logs/auth-out.log',
    },
    {
      name: 'lagaao-product',
      script: 'backend/services/product-service/dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      error_file: 'logs/product-error.log',
      out_file:   'logs/product-out.log',
    },
    {
      name: 'lagaao-cart',
      script: 'backend/services/cart-service/dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      error_file: 'logs/cart-error.log',
      out_file:   'logs/cart-out.log',
    },
    {
      name: 'lagaao-order',
      script: 'backend/services/order-service/dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      error_file: 'logs/order-error.log',
      out_file:   'logs/order-out.log',
    },
    {
      name: 'lagaao-payment',
      script: 'backend/services/payment-service/dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      error_file: 'logs/payment-error.log',
      out_file:   'logs/payment-out.log',
    },
    {
      name: 'lagaao-frontend',
      script: 'frontend/.next/standalone/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      env: { PORT: 3000, HOSTNAME: '127.0.0.1' },
      error_file: 'logs/frontend-error.log',
      out_file:   'logs/frontend-out.log',
    },
  ],
};
```

---

## Step 5 — Configure MySQL on Production

### 5.1 First-time schema setup (run once via SSH)

```bash
# SSH into your Hostinger server
ssh u123456789@YOUR_HOSTINGER_IP

# Navigate to project
cd ~/lagaao-platform

# Ensure DATABASE_URL is set (from .env or hPanel env vars)
echo $DATABASE_URL

# Run Prisma migrations
cd database
npx prisma migrate deploy --schema=prisma/schema.prisma

# Seed plant categories
cd ../backend/services/product-service
node -e "
const { PrismaClient } = require('@prisma/client');
// The category seeder is in CategoryService.seed()
// Trigger it via a one-time HTTP call after the service starts, or run:
console.log('Run POST /api/categories/seed after startup to seed categories');
"
```

### 5.2 Seed categories after first deploy

Once all services are running, call the seed endpoint:

```bash
curl -X POST https://lagaao.com/api/categories/seed \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

---

## Step 6 — Apache Reverse Proxy (.htaccess)

Hostinger uses Apache. Create `.htaccess` in the **public_html** folder to
proxy all requests to the Node.js processes:

```apache
# /home/u123456789/public_html/.htaccess

DirectoryIndex disabled
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Proxy /api/* → API Gateway (port 4000)
RewriteCond %{REQUEST_URI} ^/api/
RewriteRule ^(.*)$ http://127.0.0.1:4000/$1 [P,L]

# Proxy everything else → Next.js frontend (port 3000)
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]

# Required for ProxyPass
ProxyPassReverse / http://127.0.0.1:3000/
ProxyPassReverse /api/ http://127.0.0.1:4000/
```

> If Hostinger uses Nginx instead of Apache on your plan, ask support for the
> Nginx config or use the Hostinger subdomain proxy tool in hPanel.

---

## Step 7 — Domain Setup

### 7.1 Point lagaao.com to Hostinger

If the domain is registered at Hostinger:
1. hPanel → **Domains** → lagaao.com → **DNS Zone**
2. The `A` record pointing to your server IP should already exist

If the domain is registered elsewhere:
1. Change nameservers to Hostinger's:
   - `ns1.dns-parking.com`
   - `ns2.dns-parking.com`
2. Or add an `A` record pointing to your Hostinger server IP

### 7.2 Add domain in hPanel

1. hPanel → **Domains → Add Domain**
2. Enter `lagaao.com` and `www.lagaao.com`
3. Set document root to `/home/u123456789/lagaao-platform/public_html`

### 7.3 Enable free SSL (Let's Encrypt)

1. hPanel → **Security → SSL/TLS**
2. Click **Install** next to lagaao.com
3. Select **Let's Encrypt** (free)
4. Enable **Force HTTPS** toggle

---

## Step 8 — First Manual Deployment (SSH)

Run this once to bootstrap before CI/CD takes over:

```bash
ssh u123456789@YOUR_HOSTINGER_IP

# Clone the repo
cd ~
git clone https://github.com/YOUR_ORG/lagaao-platform.git

cd lagaao-platform

# Create .env from your prepared values
nano .env   # paste all environment variables

# Create logs directory
mkdir -p logs

# Install all workspace dependencies
npm install

# Build all services
npm run build:gateway
cd backend/services/auth-service    && npm run build && cd -
cd backend/services/product-service && npm run build && cd -
cd backend/services/cart-service    && npm run build && cd -
cd backend/services/order-service   && npm run build && cd -
cd backend/services/payment-service && npm run build && cd -
npm run build:frontend   # Next.js standalone build

# Run database migrations
cd database && npx prisma migrate deploy --schema=prisma/schema.prisma && cd ..

# Start all services with PM2
pm2 start ecosystem.config.cjs
pm2 save   # persist across server reboots
pm2 startup  # follow the printed command to enable PM2 on boot

# Verify everything is running
pm2 status
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:3000
```

---

## Step 9 — GitHub Actions CI/CD

> See `.github/workflows/deploy.yml` for the automated pipeline that runs on
> every push to `main`.

### Required GitHub Secrets

Add these in GitHub → **Settings → Secrets and variables → Actions**:

| Secret name | Value |
|---|---|
| `HOSTINGER_SSH_HOST` | Your server IP (e.g. `147.93.x.x`) |
| `HOSTINGER_SSH_USER` | SSH username (e.g. `u123456789`) |
| `HOSTINGER_SSH_KEY` | Contents of your **private** SSH key (`cat ~/.ssh/id_ed25519`) |
| `HOSTINGER_SSH_PORT` | `22` (or custom SSH port if changed) |
| `DEPLOY_PATH` | `/home/u123456789/lagaao-platform` |
| `DATABASE_URL` | `mysql://lagaao_user:PASS@127.0.0.1:3306/lagaao_db` |
| `JWT_SECRET` | Your production JWT secret |
| `NEXT_PUBLIC_API_URL` | `https://lagaao.com/api` |

---

## Step 10 — Verify Production

```bash
# From your local machine — check all health endpoints
curl https://lagaao.com/api/health            # gateway
curl https://lagaao.com/api/health/services   # all services
curl https://lagaao.com                       # frontend 200 OK

# From the server — check PM2
ssh u123456789@YOUR_HOSTINGER_IP "pm2 status"
```

Expected PM2 output:
```
┌──────────────────────┬─────┬───────┬────────┬──────┐
│ name                 │ id  │ mode  │ status │ cpu  │
├──────────────────────┼─────┼───────┼────────┼──────┤
│ lagaao-gateway       │ 0   │ fork  │ online │ 0%   │
│ lagaao-auth          │ 1   │ fork  │ online │ 0%   │
│ lagaao-product       │ 2   │ fork  │ online │ 0%   │
│ lagaao-cart          │ 3   │ fork  │ online │ 0%   │
│ lagaao-order         │ 4   │ fork  │ online │ 0%   │
│ lagaao-payment       │ 5   │ fork  │ online │ 0%   │
│ lagaao-frontend      │ 6   │ fork  │ online │ 0%   │
└──────────────────────┴─────┴───────┴────────┴──────┘
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `502 Bad Gateway` | One service is down — check `pm2 logs lagaao-gateway` |
| `Cannot connect to MySQL` | Verify `DATABASE_URL` uses `127.0.0.1` not `localhost` on Hostinger |
| Prisma migrations fail | SSH in, run `npx prisma migrate deploy` manually, check error |
| `EADDRINUSE: port already in use` | Run `pm2 delete all && pm2 start ecosystem.config.cjs` |
| SSL not working | Wait 5 min for Let's Encrypt propagation, then force renew in hPanel |
| Environment variables not loaded | Confirm `.env` file exists in project root OR hPanel env vars are set |
| Next.js `server.js` not found | Ensure `output: 'standalone'` in `next.config.ts` and rebuild |
| Cart Redis errors | Check Upstash credentials; the cart service falls back to DB if Redis is unavailable |

---

## Maintenance

```bash
# View real-time logs
pm2 logs

# Restart a single service without downtime
pm2 reload lagaao-gateway

# Restart all
pm2 reload all

# Pull latest code and redeploy (manual, same as what CI/CD does)
cd ~/lagaao-platform
git pull origin main
npm install
npm run build --workspaces --if-present
cd database && npx prisma migrate deploy --schema=prisma/schema.prisma && cd ..
pm2 reload all
```
