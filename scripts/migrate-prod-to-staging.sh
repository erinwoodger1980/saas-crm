#!/bin/bash

# Database migration script: Production → Staging

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

PROD_DB='postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require'
STAGING_DB='postgresql://joineryai_db_staging_user:kXLKGlH9fWCTfEE9hvu3gdJsg8l9xHBu@dpg-d5gir4h5pdvs73cn3u8g-a.oregon-postgres.render.com/joineryai_db_staging?sslmode=require'

echo "🔄 Database Migration: Production → Staging"
echo "==========================================="
echo ""

# Step 1: Export production database
echo "📤 Step 1: Exporting production database..."
pg_dump --clean --if-exists --no-owner --no-privileges "$PROD_DB" -v > /tmp/prod-full-backup.sql 2>&1
DUMP_SIZE=$(du -h /tmp/prod-full-backup.sql | cut -f1)
echo "✅ Export complete - Size: $DUMP_SIZE"
echo ""

# Step 2: Import to staging database
echo "📥 Step 2: Importing to staging database..."
echo "⏳ This may take several minutes..."
psql "$STAGING_DB" < /tmp/prod-full-backup.sql 2>&1 | tail -50
echo ""

# Step 3: Verify migration
echo "✔️  Step 3: Verifying migration..."
USER_COUNT=$(psql "$STAGING_DB" -t -c "SELECT COUNT(*) FROM \"User\";" 2>&1)
if [ ! -z "$USER_COUNT" ] && [ "$USER_COUNT" -gt 0 ]; then
  echo "✅ Migration successful!"
  echo "   - Found $USER_COUNT users in staging database"
else
  echo "⚠️  Migration may have issues. Please verify manually."
  echo "   USER_COUNT: $USER_COUNT"
fi

echo ""
echo "✅ Migration complete!"
echo ""
echo "Staging environment ready for testing."
echo "You can now login with production credentials at:"
echo "https://staging.joineryai.app"
