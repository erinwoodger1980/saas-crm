#!/bin/bash
# seed-laj-live.sh: Seed LAJ Joinery tenant and materials in PRODUCTION database

export DATABASE_URL="postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require"

cd "$(dirname "$0")"

echo "🚨 WARNING: You are about to seed LAJ Joinery data into PRODUCTION database"
echo "Production DB: dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db"
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
