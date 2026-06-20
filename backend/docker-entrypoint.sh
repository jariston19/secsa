#!/bin/sh
set -e

npx prisma migrate deploy

case "${SEED_ON_START:-false}" in
  true|1|yes|YES)
    echo "Running database seed..."
    npx tsx prisma/seed.ts
    ;;
  *)
    echo "Skipping database seed. Set SEED_ON_START=true to run prisma/seed.ts."
    ;;
esac

exec node dist/index.js
