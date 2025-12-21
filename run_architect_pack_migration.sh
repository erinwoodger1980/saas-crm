#!/bin/bash

# Architect Pack Migration Script
# Run this to apply the architect pack tables to production database

echo "🚀 Architect Pack Migration"
echo "==========================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo ""
    echo "Please set it first:"
    echo "export DATABASE_URL='postgresql://joineryai_db_user:password@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db'"
    exit 1
fi

echo "📋 Migration will:"
echo "  - Create ArchitectPack table"
echo "  - Create ArchitectPackAnalysis table"
echo "  - Create ArchitectOpening table"
echo "  - Add all indexes and foreign keys"
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

echo ""
echo "🔄 Running migration..."
echo ""

# Run the migration SQL
psql "$DATABASE_URL" < architect_pack_migration.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "  1. Run: cd api && npx prisma generate"
    echo "  2. Verify tables: psql \$DATABASE_URL -c \"\\dt ArchitectPack\""
    echo "  3. Check migration record: INSERT INTO _prisma_migrations..."
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    echo "Check the error messages above"
    exit 1
fi
