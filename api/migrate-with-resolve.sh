#!/bin/bash
set -e

cd "$(dirname "$0")"

# Load api/.env if present.
if [ -f ".env" ]; then
	set -a
	source .env
	set +a
fi

if [ -z "$DATABASE_URL" ]; then
	echo "❌ ERROR: DATABASE_URL not set."
	echo "Set it in api/.env (or export it) before running this script."
	exit 1
fi

echo "🔍 Checking for failed migrations..."

# Try to resolve the failed migration
npx prisma migrate resolve --rolled-back "20251126122031_add_task_template" 2>/dev/null || true

echo "✅ Migration state checked, proceeding with deploy..."
npx prisma migrate deploy
