# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifest (workspaces) and lock file
COPY package*.json ./

# Copy the shared Prisma schema
COPY database/prisma ./database/prisma

# Copy this service's manifest so npm can resolve its deps
COPY backend/services/auth-service/package*.json ./backend/services/auth-service/

# Install only this service's dependencies (no hoisting needed inside Docker)
WORKDIR /app/backend/services/auth-service
RUN npm install --ignore-scripts

# Copy source
WORKDIR /app
COPY backend/services/auth-service ./backend/services/auth-service

# Generate Prisma client pointing to the shared schema
RUN npx prisma generate \
      --schema=/app/database/prisma/schema.prisma \
      --generator client \
    && mv /app/node_modules/.prisma /app/backend/services/auth-service/node_modules/.prisma 2>/dev/null || true

WORKDIR /app/backend/services/auth-service
RUN npm run build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/backend/services/auth-service/dist        ./dist
COPY --from=builder --chown=nestjs:nodejs /app/backend/services/auth-service/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/database/prisma                            ./database/prisma

USER nestjs

EXPOSE 4001

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4001/health || exit 1

CMD ["node", "dist/main"]
