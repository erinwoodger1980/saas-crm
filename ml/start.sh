#!/bin/bash
# ml/start.sh - Production startup script for ML service

echo "🚀 Starting Joinery AI ML Service..."

# Print environment info
echo "📍 Environment: ${APP_ENV:-development}"
echo "🗄️  Database URL configured: $([ -n "$DATABASE_URL" ] && echo "✅ Yes" || echo "⚠️  No")"
echo "🔧 Models directory: ${MODELS_DIR:-./models}"

# Check if we can connect to database
if [ -n "$DATABASE_URL" ]; then
    echo "🔍 Testing database connection..."
    python -c "
import os, psycopg
try:
    conn = psycopg.connect(os.getenv('DATABASE_URL'))
    conn.close()
    print('✅ Database connection successful')
except Exception as e:
    print(f'⚠️  Database connection failed: {e}')
    print('📝 Email training features will be disabled')
" 2>/dev/null || echo "⚠️  psycopg not available, email training disabled"
else
    echo "⚠️  DATABASE_URL not set, email training features disabled"
fi

# Start the service
echo "🌟 Starting ML service on port ${PORT:-8000}..."
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}