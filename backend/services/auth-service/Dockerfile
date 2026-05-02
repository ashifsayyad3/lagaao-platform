# ── Stage 1: install all deps + generate Prisma client + compile ──────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Layer-cache: copy manifests before source so a source change doesn't bust deps
COPY database/prisma                                      ./database/prisma
COPY backend/services/auth-service/package*.json         ./backend/services/auth-service/
COPY backend/services/auth-service/tsconfig*.json        ./backend/services/auth-service/
COPY backend/services/auth-service/nest-cli.json         ./backend/services/auth-service/

WORKDIR /app/backend/services/auth-service

# Full install (devDeps needed for tsc / nest build)
RUN npm install --ignore-scripts

# Generate Prisma client — runs from service dir so .prisma lands in ./node_modules
RUN npx prisma generate --schema=/app/database/prisma/schema.prisma

# Copy source and compile
COPY backend/services/auth-service/src ./src
RUN npm run build

# ── Stage 2: lean production image ───────────────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nestjs

WORKDIR /app

# Re-install production-only deps for a smaller node_modules
COPY --chown=nestjs:nodejs backend/services/auth-service/package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy Prisma query engine binary that was compiled in the builder stage
COPY --from=builder --chown=nestjs:nodejs \
     /app/backend/services/auth-service/node_modules/.prisma \
     ./node_modules/.prisma

# Copy schema (Prisma needs it at runtime for migrations / introspection)
COPY --from=builder --chown=nestjs:nodejs /app/database/prisma ./database/prisma

# Copy compiled application
COPY --from=builder --chown=nestjs:nodejs \
     /app/backend/services/auth-service/dist ./dist

USER nestjs

EXPOSE 4001

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4001/health || exit 1

CMD ["node", "dist/main"]
