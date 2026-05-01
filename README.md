# lagaao.com — E-Commerce Platform

A full-stack e-commerce platform built as a Node.js monorepo with a Next.js 14 storefront and NestJS microservices backend.

## Architecture

```
lagaao-platform/
├── frontend/               Next.js 14 storefront (TypeScript, Tailwind, ShadCN)
├── backend/
│   ├── api-gateway/        NestJS reverse-proxy & JWT auth guard (port 4000)
│   └── services/
│       ├── auth-service/   Registration, login, Google OAuth, JWT (port 4001)
│       ├── product-service/ Catalogue, categories, images via Cloudinary (port 4002)
│       ├── cart-service/   Cart backed by Redis + MySQL (port 4003)
│       ├── order-service/  Order lifecycle & status tracking (port 4004)
│       └── payment-service/ Razorpay & Stripe integrations, webhooks (port 4005)
├── database/
│   └── prisma/             Single shared Prisma schema (MySQL)
└── infrastructure/
    └── docker/             docker-compose for all services + MySQL + Redis
```

All frontend traffic flows through the API Gateway. The gateway validates JWTs and proxies requests to the appropriate microservice.

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- Docker & Docker Compose
- MySQL 8.0 (or use Docker)
- Redis 7 (or use Docker)

## Quick Start

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Start infrastructure (MySQL + Redis)
npm run docker:up

# 4. Run database migrations
npm run db:migrate

# 5. Start all services in dev mode
npm run dev
```

## Service URLs (development)

| Service          | URL                        |
|------------------|----------------------------|
| Frontend         | http://localhost:3000       |
| API Gateway      | http://localhost:4000       |
| API Docs (Swagger)| http://localhost:4000/api  |
| Auth Service     | http://localhost:4001       |
| Product Service  | http://localhost:4002       |
| Cart Service     | http://localhost:4003       |
| Order Service    | http://localhost:4004       |
| Payment Service  | http://localhost:4005       |
| Prisma Studio    | http://localhost:5555       |

## Database

The Prisma schema lives in `database/prisma/schema.prisma` and is shared across all services via `@prisma/client`.

```bash
npm run db:generate    # Regenerate Prisma client after schema changes
npm run db:migrate     # Create and apply a new migration
npm run db:studio      # Open Prisma Studio in the browser
```

## Docker

```bash
npm run docker:up      # Start all containers in detached mode
npm run docker:down    # Stop all containers
npm run docker:build   # Rebuild images after Dockerfile changes
```

## Payment Providers

- **Razorpay** — primary provider for India (INR)
- **Stripe** — international cards
- **COD** — Cash on Delivery

Configure the respective keys in `.env`. Webhook endpoints are `/payments/webhook/razorpay` and `/payments/webhook/stripe` on the payment service.

## Tech Stack

| Layer         | Technology                              |
|---------------|-----------------------------------------|
| Frontend      | Next.js 14, TypeScript, Tailwind, ShadCN|
| State / Data  | Zustand, TanStack Query, React Hook Form|
| Backend       | NestJS 10, TypeScript                   |
| ORM           | Prisma 5 (MySQL 8)                      |
| Auth          | JWT (RS256), Passport.js, Google OAuth  |
| Cache / Queue | Redis (ioredis)                         |
| File Storage  | Cloudinary                              |
| Payments      | Razorpay, Stripe                        |
| Containers    | Docker, Docker Compose                  |
