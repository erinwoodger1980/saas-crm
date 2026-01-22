#!/bin/bash
# migrate-live.sh: Run Prisma migration in the live environment

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

# If you use a shadow database, set SHADOW_DATABASE_URL in api/.env as well.

npx prisma migrate deploy
npx prisma generate
