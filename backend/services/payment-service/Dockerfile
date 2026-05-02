# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY database/prisma                                        ./database/prisma
COPY backend/services/payment-service/package*.json        ./backend/services/payment-service/
COPY backend/services/payment-service/tsconfig*.json       ./backend/services/payment-service/
COPY backend/services/payment-service/nest-cli.json        ./backend/services/payment-service/

WORKDIR /app/backend/services/payment-service

RUN npm install --ignore-scripts

RUN npx prisma generate --schema=/app/database/prisma/schema.prisma

COPY backend/services/payment-service/src ./src
RUN npm run build

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

COPY --chown=nestjs:nodejs backend/services/payment-service/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder --chown=nestjs:nodejs \
     /app/backend/services/payment-service/node_modules/.prisma \
     ./node_modules/.prisma

COPY --from=builder --chown=nestjs:nodejs /app/database/prisma ./database/prisma
COPY --from=builder --chown=nestjs:nodejs \
     /app/backend/services/payment-service/dist ./dist

USER nestjs

EXPOSE 4005

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4005/health || exit 1

CMD ["node", "dist/main"]
