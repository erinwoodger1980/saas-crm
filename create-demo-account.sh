#!/bin/bash

# Quick script to create a demo account on the deployed API service
# Usage: ./create-demo-account.sh [email] [password]

EMAIL=${1:-"demo@acme.test"}
PASSWORD=${2:-"Password123!"}
API_URL=${3:-"https://joinery-ai.onrender.com"}

echo "Creating demo account..."
echo "Email: $EMAIL"
echo "Password: $PASSWORD"
echo "API URL: $API_URL"
echo ""

# Create the account using the bootstrap script approach
# Note: This would need to be run on the server with database access
echo "To create a demo account on the deployed server, run this command on the API service:"
echo ""
echo "node scripts/bootstrap-admin.mjs $EMAIL $PASSWORD"
echo ""
echo "Or if you have database access locally:"
echo "cd api && DATABASE_URL='your_production_db_url' node scripts/bootstrap-admin.mjs $EMAIL $PASSWORD"
echo ""
echo "After creating the account, you can log in at:"
echo "https://your-web-service.onrender.com/login"
echo "  Email: $EMAIL"
echo "  Password: $PASSWORD"