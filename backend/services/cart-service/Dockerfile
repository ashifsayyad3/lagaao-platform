# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY database/prisma                                     ./database/prisma
COPY backend/services/cart-service/package*.json        ./backend/services/cart-service/
COPY backend/services/cart-service/tsconfig*.json       ./backend/services/cart-service/
COPY backend/services/cart-service/nest-cli.json        ./backend/services/cart-service/

WORKDIR /app/backend/services/cart-service

RUN npm install --ignore-scripts

RUN npx prisma generate --schema=/app/database/prisma/schema.prisma

COPY backend/services/cart-service/src ./src
RUN npm run build

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

COPY --chown=nestjs:nodejs backend/services/cart-service/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder --chown=nestjs:nodejs \
     /app/backend/services/cart-service/node_modules/.prisma \
     ./node_modules/.prisma

COPY --from=builder --chown=nestjs:nodejs /app/database/prisma ./database/prisma
COPY --from=builder --chown=nestjs:nodejs \
     /app/backend/services/cart-service/dist ./dist

USER nestjs

EXPOSE 4003

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4003/health || exit 1

CMD ["node", "dist/main"]
