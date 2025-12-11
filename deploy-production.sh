#!/bin/bash

echo "🚀 Deploying to Production"
echo ""
echo "This will trigger the GitHub Actions workflow to deploy to production."
echo ""
read -p "Type 'deploy' to confirm: " confirm

if [ "$confirm" != "deploy" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "📦 Pushing any pending changes..."
git push origin main

echo ""
echo "🌐 Opening GitHub Actions to trigger deployment..."
echo "   URL: https://github.com/erinwoodger1980/saas-crm/actions/workflows/deploy-production.yml"
echo ""
echo "Steps:"
echo "1. Click 'Run workflow' button"
echo "2. Type 'deploy' in the confirmation field"
echo "3. Click 'Run workflow' to start deployment"
echo ""

# Open the GitHub Actions page
if command -v open &> /dev/null; then
    open "https://github.com/erinwoodger1980/saas-crm/actions/workflows/deploy-production.yml"
elif command -v xdg-open &> /dev/null; then
    xdg-open "https://github.com/erinwoodger1980/saas-crm/actions/workflows/deploy-production.yml"
else
    echo "Please open this URL in your browser:"
    echo "https://github.com/erinwoodger1980/saas-crm/actions/workflows/deploy-production.yml"
fi
