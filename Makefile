COMPOSE      := docker compose -f infrastructure/docker/docker-compose.yml
COMPOSE_DEV  := $(COMPOSE) -f infrastructure/docker/docker-compose.override.yml
ENV_FILE     := infrastructure/docker/.env

# ── Lifecycle ─────────────────────────────────────────────────────────────────

.PHONY: up down restart build logs ps

up: ## Start all services (production images)
	$(COMPOSE) --env-file $(ENV_FILE) up -d

down: ## Stop and remove containers
	$(COMPOSE) --env-file $(ENV_FILE) down

restart: ## Restart all containers without rebuilding
	$(COMPOSE) --env-file $(ENV_FILE) restart

build: ## Build (or rebuild) all images
	$(COMPOSE) --env-file $(ENV_FILE) build --parallel

logs: ## Tail logs for all services (Ctrl-C to stop)
	$(COMPOSE) --env-file $(ENV_FILE) logs -f

ps: ## Show running containers and health status
	$(COMPOSE) --env-file $(ENV_FILE) ps

# ── Development mode ──────────────────────────────────────────────────────────

.PHONY: dev dev-down dev-logs

dev: ## Start all services in watch/live-reload mode
	$(COMPOSE_DEV) --env-file $(ENV_FILE) up -d

dev-down: ## Stop dev containers
	$(COMPOSE_DEV) --env-file $(ENV_FILE) down

dev-logs: ## Tail dev logs
	$(COMPOSE_DEV) --env-file $(ENV_FILE) logs -f

# ── Infrastructure only ───────────────────────────────────────────────────────

.PHONY: infra infra-down

infra: ## Start only MySQL and Redis
	$(COMPOSE) --env-file $(ENV_FILE) up -d mysql redis

infra-down: ## Stop only MySQL and Redis
	$(COMPOSE) --env-file $(ENV_FILE) stop mysql redis

# ── Per-service shortcuts ─────────────────────────────────────────────────────

.PHONY: build-auth build-product build-cart build-order build-payment build-gateway build-frontend

build-auth:     ; $(COMPOSE) --env-file $(ENV_FILE) build auth-service
build-product:  ; $(COMPOSE) --env-file $(ENV_FILE) build product-service
build-cart:     ; $(COMPOSE) --env-file $(ENV_FILE) build cart-service
build-order:    ; $(COMPOSE) --env-file $(ENV_FILE) build order-service
build-payment:  ; $(COMPOSE) --env-file $(ENV_FILE) build payment-service
build-gateway:  ; $(COMPOSE) --env-file $(ENV_FILE) build api-gateway
build-frontend: ; $(COMPOSE) --env-file $(ENV_FILE) build frontend

# ── Database ──────────────────────────────────────────────────────────────────

.PHONY: db-migrate db-studio db-shell

db-migrate: ## Run Prisma migrations inside a one-shot container
	docker run --rm \
	  --network lagaao-network \
	  -e DATABASE_URL=mysql://$(shell grep ^DATABASE_USER $(ENV_FILE) | cut -d= -f2):$(shell grep ^DATABASE_PASSWORD $(ENV_FILE) | cut -d= -f2)@mysql:3306/$(shell grep ^DATABASE_NAME $(ENV_FILE) | cut -d= -f2) \
	  -v $(PWD)/database/prisma:/app/database/prisma \
	  node:20-alpine \
	  sh -c "npm i -g prisma && prisma migrate deploy --schema=/app/database/prisma/schema.prisma"

db-shell: ## Open a MySQL shell in the running container
	docker exec -it lagaao-mysql mysql -u root -p

# ── Cleanup ───────────────────────────────────────────────────────────────────

.PHONY: clean nuke

clean: ## Remove stopped containers and dangling images
	docker system prune -f

nuke: ## WARNING: remove ALL containers, volumes (destroys DB data)
	$(COMPOSE) --env-file $(ENV_FILE) down -v --remove-orphans
	docker image prune -f --filter "label=com.docker.compose.project=docker"

# ── Help ──────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
