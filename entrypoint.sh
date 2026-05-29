#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Aborting."
  exit 1
fi

echo "Running database migrations..."
node_modules/.bin/prisma migrate deploy
echo "Migrations complete."

echo "Running database seed..."
node prisma/seed.js
echo "Seed complete."

exec node server.js
