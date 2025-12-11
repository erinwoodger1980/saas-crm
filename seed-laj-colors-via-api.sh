#!/bin/bash
# Seed LAJ Joinery default colors via API
# Run this script after deploying the API to production

# LAJ tenant colors
LAJ_COLORS='{
  "colors": {
    "In BOM": { "bg": "#fde047", "text": "#854d0e" },
    "In BOM TBC": { "bg": "#fde047", "text": "#854d0e" },
    "Ordered": { "bg": "#fb923c", "text": "#7c2d12" },
    "Received": { "bg": "#86efac", "text": "#14532d" },
    "Stock": { "bg": "#86efac", "text": "#14532d" },
    "Received from TGS": { "bg": "#86efac", "text": "#14532d" },
    "Received from Customer": { "bg": "#86efac", "text": "#14532d" },
    "In Factory": { "bg": "#86efac", "text": "#14532d" },
    "Printed in Office": { "bg": "#86efac", "text": "#14532d" },
    "Booked": { "bg": "#86efac", "text": "#14532d" }
  }
}'

echo "Seeding LAJ default colors..."
echo "This requires an authenticated session as an LAJ user"
echo ""
echo "Make a POST request to: /api/fire-door-schedule/colors"
echo "With body:"
echo "$LAJ_COLORS"
echo ""
echo "You can do this by:"
echo "1. Log in to the app as an LAJ user (tenant: cmi58fkzm0000it43i4h78pej)"
echo "2. Open browser console"
echo "3. Run: fetch('/api/fire-door-schedule/colors', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify($LAJ_COLORS) })"
echo ""
echo "Or use this curl command with a valid session token:"
echo "curl -X POST https://your-domain.com/api/fire-door-schedule/colors \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Cookie: your-session-cookie' \\"
echo "  -d '$LAJ_COLORS'"
