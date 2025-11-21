#!/bin/bash
# Grant developer access to a user
# Usage: ./scripts/grant-dev-access.sh <email> <prod-db-url>

EMAIL=$1
DB_URL=$2

if [ -z "$EMAIL" ] || [ -z "$DB_URL" ]; then
  echo "Usage: ./scripts/grant-dev-access.sh <email> <prod-db-url>"
  exit 1
fi

DATABASE_URL="$DB_URL" pnpm ts-node scripts/make-user-developer.ts "$EMAIL"
