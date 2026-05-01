FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY database/prisma ./database/prisma
COPY backend/api-gateway/package*.json ./backend/api-gateway/

WORKDIR /app/backend/api-gateway
RUN npm install --ignore-scripts

WORKDIR /app
COPY backend/api-gateway ./backend/api-gateway

WORKDIR /app/backend/api-gateway
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/backend/api-gateway/dist        ./dist
COPY --from=builder --chown=nestjs:nodejs /app/backend/api-gateway/node_modules ./node_modules

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/main"]
