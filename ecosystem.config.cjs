/**
 * PM2 ecosystem file for lagaao.com on Hostinger Node.js hosting.
 *
 * Start:   pm2 start ecosystem.config.cjs
 * Reload:  pm2 reload all          (zero-downtime)
 * Status:  pm2 status
 * Logs:    pm2 logs
 * Save:    pm2 save                (persist after reboot)
 */

'use strict';

const BASE = __dirname;

/** @type {import('pm2').StartOptions[]} */
const apps = [
  // ── API Gateway (public-facing, reverse-proxied by Apache/Nginx) ───────────
  {
    name: 'lagaao-gateway',
    script: `${BASE}/backend/api-gateway/dist/main.js`,
    instances: 1,
    exec_mode: 'fork',
    env_file: `${BASE}/.env`,
    env: { API_GATEWAY_PORT: '4000' },
    error_file: `${BASE}/logs/gateway-error.log`,
    out_file: `${BASE}/logs/gateway-out.log`,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_restarts: 10,
    min_uptime: '5s',
    watch: false,
  },

  // ── Auth Service ───────────────────────────────────────────────────────────
  {
    name: 'lagaao-auth',
    script: `${BASE}/backend/services/auth-service/dist/main.js`,
    instances: 1,
    exec_mode: 'fork',
    env_file: `${BASE}/.env`,
    env: { AUTH_SERVICE_PORT: '4001' },
    error_file: `${BASE}/logs/auth-error.log`,
    out_file: `${BASE}/logs/auth-out.log`,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_restarts: 10,
    min_uptime: '5s',
    watch: false,
  },

  // ── Product Service ────────────────────────────────────────────────────────
  {
    name: 'lagaao-product',
    script: `${BASE}/backend/services/product-service/dist/main.js`,
    instances: 1,
    exec_mode: 'fork',
    env_file: `${BASE}/.env`,
    env: { PRODUCT_SERVICE_PORT: '4002' },
    error_file: `${BASE}/logs/product-error.log`,
    out_file: `${BASE}/logs/product-out.log`,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_restarts: 10,
    min_uptime: '5s',
    watch: false,
  },

  // ── Cart Service ───────────────────────────────────────────────────────────
  {
    name: 'lagaao-cart',
    script: `${BASE}/backend/services/cart-service/dist/main.js`,
    instances: 1,
    exec_mode: 'fork',
    env_file: `${BASE}/.env`,
    env: { CART_SERVICE_PORT: '4003' },
    error_file: `${BASE}/logs/cart-error.log`,
    out_file: `${BASE}/logs/cart-out.log`,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_restarts: 10,
    min_uptime: '5s',
    watch: false,
  },

  // ── Order Service ──────────────────────────────────────────────────────────
  {
    name: 'lagaao-order',
    script: `${BASE}/backend/services/order-service/dist/main.js`,
    instances: 1,
    exec_mode: 'fork',
    env_file: `${BASE}/.env`,
    env: { ORDER_SERVICE_PORT: '4004' },
    error_file: `${BASE}/logs/order-error.log`,
    out_file: `${BASE}/logs/order-out.log`,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_restarts: 10,
    min_uptime: '5s',
    watch: false,
  },

  // ── Payment Service ────────────────────────────────────────────────────────
  {
    name: 'lagaao-payment',
    script: `${BASE}/backend/services/payment-service/dist/main.js`,
    instances: 1,
    exec_mode: 'fork',
    env_file: `${BASE}/.env`,
    env: { PAYMENT_SERVICE_PORT: '4005' },
    error_file: `${BASE}/logs/payment-error.log`,
    out_file: `${BASE}/logs/payment-out.log`,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_restarts: 10,
    min_uptime: '5s',
    watch: false,
  },

  // ── Next.js Frontend ───────────────────────────────────────────────────────
  {
    name: 'lagaao-frontend',
    // next build --standalone emits a self-contained server at this path
    script: `${BASE}/frontend/.next/standalone/server.js`,
    instances: 1,
    exec_mode: 'fork',
    env_file: `${BASE}/.env`,
    env: {
      PORT: '3000',
      HOSTNAME: '127.0.0.1',
    },
    error_file: `${BASE}/logs/frontend-error.log`,
    out_file: `${BASE}/logs/frontend-out.log`,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_restarts: 10,
    min_uptime: '5s',
    watch: false,
  },
];

module.exports = { apps };
