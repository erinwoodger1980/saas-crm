#!/bin/bash

# Sync Fire Door Projects to Won Opportunities
# 
# This script calls the API endpoint to create/update opportunities for fire door projects
# Usage: ./sync-fire-door-opportunities.sh

echo "Syncing fire door schedule projects to won opportunities..."
echo ""

# Call the API endpoint (requires authentication)
# You'll need to provide a valid session cookie or token
curl -X POST "https://joineryai.app/fire-door-schedule/sync-to-opportunities" \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE_HERE" \
  -v

echo ""
echo "Sync complete! Check the response above for details."
