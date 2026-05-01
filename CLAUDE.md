# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all workspace dependencies
npm install

# Start everything in dev mode (frontend + gateway + all services)
npm run dev

# Start individual pieces
npm run dev:frontend      # Next.js on :3000
npm run dev:gateway       # API Gateway on :4000
npm run dev:auth          # Auth service on :4001
npm run dev:product       # Product service on :4002
npm run dev:cart          # Cart service on :4003
npm run dev:order         # Order service on :4004
npm run dev:payment       # Payment service on :4005

# Build
npm run build
npm run build:frontend
npm run build:gateway

# Test (run from monorepo root or within a workspace)
npm run test
npm run test --workspace=backend/services/auth-service

# Lint
npm run lint

# Database
npm run db:generate       # Regenerate Prisma client after schema changes
npm run db:migrate        # Create + apply migration (dev)
npm run db:studio         # Open Prisma Studio

# Docker
npm run docker:up         # Start MySQL + Redis + all service containers
npm run docker:down
npm run docker:build
```

## Architecture

All HTTP traffic from the browser hits the **API Gateway** (`backend/api-gateway`, port 4000) first. The gateway validates JWTs and reverse-proxies requests to the relevant microservice. The frontend (`frontend/`) communicates exclusively with the gateway via `NEXT_PUBLIC_API_URL`.

```
Browser → Next.js (3000) → API Gateway (4000) → auth-service    (4001)
                                               → product-service (4002)
                                               → cart-service    (4003)
                                               → order-service   (4004)
                                               → payment-service (4005)
```

Each NestJS microservice is an independent npm workspace under `backend/services/`. They share a single Prisma schema at `database/prisma/schema.prisma` and import `@prisma/client` directly.

**Cart** uses Redis as a fast session store on top of MySQL for persistence. **Payment** has two providers: Razorpay (India/INR) and Stripe (international); webhook handlers live in payment-service.

## Database

- Single `schema.prisma` shared by all services — edit models there and run `npm run db:generate` to update the client across every service.
- MySQL 8 with `utf8mb4_unicode_ci` collation.
- `DATABASE_URL` in `.env` is the canonical connection string.

## Environment

Copy `.env.example` → `.env` before starting. All service ports, DB credentials, JWT secrets, Stripe/Razorpay keys, Cloudinary, Redis, and SMTP config live there.

## Key Packages per Layer

| Layer | Key packages |
|---|---|
| Frontend | `next`, `zustand`, `@tanstack/react-query`, `react-hook-form` + `zod`, `next-auth`, ShadCN (`@radix-ui/*`, `class-variance-authority`) |
| All NestJS services | `@nestjs/common`, `@nestjs/config`, `@nestjs/jwt`, `@prisma/client` |
| Auth service | `passport`, `passport-jwt`, `passport-google-oauth20`, `bcryptjs` |
| Cart service | `ioredis` |
| Payment service | `stripe`, `razorpay` |
| Product service | `cloudinary`, `multer` |
