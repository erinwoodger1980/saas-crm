#!/bin/bash
# migrate-live.sh: Run Prisma migration in the live environment

export DATABASE_URL="postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require"

# If you use a shadow database, uncomment and set below:
# export SHADOW_DATABASE_URL="your_live_shadow_database_url_here"

cd "$(dirname "$0")"

npx prisma migrate deploy
npx prisma generate
