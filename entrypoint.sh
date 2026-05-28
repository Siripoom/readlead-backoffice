#!/bin/sh
set -e
echo "DATABASE_URL is set: ${DATABASE_URL:+yes}${DATABASE_URL:-no}"
echo "Running database migrations..."
node_modules/.bin/prisma migrate deploy

if [ "$SEED_ON_DEPLOY" = "true" ]; then
  echo "Running database seed..."
  node prisma/seed.js
fi

exec node server.js
