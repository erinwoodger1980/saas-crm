#!/bin/bash
# Test ML endpoints in production after API redeploys

echo "================================================"
echo "Testing ML Service in Production"
echo "================================================"
echo ""

# Test 1: Public ML health check (no auth)
echo "1️⃣  Testing public ML health endpoint..."
echo "   GET https://api.joineryai.app/public/ml/health"
echo ""
curl -s https://api.joineryai.app/public/ml/health | jq '.'
echo ""
echo ""

# Test 2: Direct ML service check
echo "2️⃣  Testing ML service directly..."
echo "   GET https://new-ml-zo9l.onrender.com/"
echo ""
curl -s https://new-ml-zo9l.onrender.com/ | jq '.'
echo ""
echo ""

# Test 3: ML service health endpoint
echo "3️⃣  Testing ML service /health endpoint..."
echo "   GET https://new-ml-zo9l.onrender.com/health"
echo ""
curl -s https://new-ml-zo9l.onrender.com/health | jq '.'
echo ""
echo ""

echo "================================================"
echo "✅ Public endpoints tested"
echo ""
echo "Next steps (requires authentication):"
echo "  - Test /ml/predict-lines via authenticated API call"
echo "  - Test quote pricing in UI with supplier costs"
echo "================================================"
