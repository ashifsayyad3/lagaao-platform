#!/bin/sh
# Runs `prisma migrate deploy` then hands off to the service process.
# Mount this script into any NestJS service container and use it as the CMD
# if you want automatic schema migrations on startup.
#
# Usage in docker-compose.yml:
#   command: ["/app/migrate-and-start.sh", "node", "dist/main"]

set -e

SCHEMA_PATH="${PRISMA_SCHEMA_PATH:-/app/database/prisma/schema.prisma}"

echo "[migrate-and-start] Running prisma migrate deploy..."
npx prisma migrate deploy --schema="$SCHEMA_PATH"
echo "[migrate-and-start] Migrations complete. Starting service: $*"

exec "$@"
