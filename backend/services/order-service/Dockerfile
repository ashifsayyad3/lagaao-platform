FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY database/prisma ./database/prisma
COPY backend/services/order-service/package*.json ./backend/services/order-service/

WORKDIR /app/backend/services/order-service
RUN npm install --ignore-scripts

WORKDIR /app
COPY backend/services/order-service ./backend/services/order-service

RUN npx prisma generate \
      --schema=/app/database/prisma/schema.prisma \
      --generator client \
    && mv /app/node_modules/.prisma /app/backend/services/order-service/node_modules/.prisma 2>/dev/null || true

WORKDIR /app/backend/services/order-service
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/backend/services/order-service/dist        ./dist
COPY --from=builder --chown=nestjs:nodejs /app/backend/services/order-service/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/database/prisma                             ./database/prisma

USER nestjs

EXPOSE 4004

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4004/health || exit 1

CMD ["node", "dist/main"]
