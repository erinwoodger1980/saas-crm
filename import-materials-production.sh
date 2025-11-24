#!/bin/bash
# Import material costs to production database
# Usage: ./import-materials-production.sh <production_database_url>

if [ -z "$1" ]; then
  echo "ERROR: Production database URL required"
  echo "Usage: ./import-materials-production.sh <production_database_url>"
  echo ""
  echo "Get the database URL from:"
  echo "1. Go to Render dashboard"
  echo "2. Find your PostgreSQL database"
  echo "3. Copy the External Database URL"
  echo ""
  exit 1
fi

PROD_DB_URL="$1"
TENANT_ID="cmi57aof70000itdhlazqjki7"

echo "Importing materials to PRODUCTION database..."
echo "Tenant: $TENANT_ID"
echo ""

# Export DATABASE_URL for the Python script
export DATABASE_URL="$PROD_DB_URL"

# Run the import
python3 import-material-costs.py "$TENANT_ID"

echo ""
echo "Import complete!"
echo "Materials should now be visible in production at https://www.joineryai.app/settings"
