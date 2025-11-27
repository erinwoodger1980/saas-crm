#!/bin/bash
# push-schema-live.sh: Push Prisma schema changes directly to live database (no migrations)

export DATABASE_URL="postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require"

cd "$(dirname "$0")"

echo "🚀 Pushing schema changes to production database..."
npx prisma db push --accept-data-loss

echo "✅ Schema push complete. Generating Prisma client..."
npx prisma generate

echo "🎉 Done! Production database schema is now synced."
