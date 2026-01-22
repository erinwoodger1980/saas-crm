#!/bin/bash
# seed-laj-live.sh: Seed LAJ Joinery tenant and materials in PRODUCTION database

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

echo "🚨 WARNING: You are about to seed LAJ Joinery data into PRODUCTION database"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to proceed): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "📦 Step 1: Seeding LAJ Joinery tenant..."
pnpm run seed:laj-tenant

if [ $? -ne 0 ]; then
    echo "❌ Failed to seed tenant"
    exit 1
fi

echo ""
echo "📦 Step 2: Seeding LAJ Joinery materials..."
pnpm run seed:laj-materials

if [ $? -ne 0 ]; then
    echo "❌ Failed to seed materials"
    exit 1
fi

echo ""
echo "✅ LAJ Joinery tenant and materials successfully seeded in PRODUCTION!"
echo ""
