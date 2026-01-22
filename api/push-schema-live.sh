#!/bin/bash
# push-schema-live.sh: Push Prisma schema changes directly to live database (no migrations)

cd "$(dirname "$0")"

# Load api/.env if present (do not hardcode credentials in this script).
if [ -f ".env" ]; then
	set -a
	source .env
	set +a
fi

if [ -z "$DATABASE_URL" ]; then
	echo "❌ ERROR: DATABASE_URL not set."
	echo "Set it in api/.env or export it in your shell before running this script."
	exit 1
fi

echo "🚀 Pushing schema changes to production database..."
npx prisma db push --accept-data-loss

echo "✅ Schema push complete. Generating Prisma client..."
npx prisma generate

echo "🎉 Done! Production database schema is now synced."
