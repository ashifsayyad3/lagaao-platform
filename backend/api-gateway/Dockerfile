# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/api-gateway/package*.json  ./backend/api-gateway/
COPY backend/api-gateway/tsconfig*.json ./backend/api-gateway/
COPY backend/api-gateway/nest-cli.json  ./backend/api-gateway/

WORKDIR /app/backend/api-gateway

RUN npm install --ignore-scripts

COPY backend/api-gateway/src ./src
RUN npm run build

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

COPY --chown=nestjs:nodejs backend/api-gateway/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder --chown=nestjs:nodejs /app/backend/api-gateway/dist ./dist

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main"]
