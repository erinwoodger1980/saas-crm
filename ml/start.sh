#!/bin/bash
# ml/start.sh - Production startup script for ML service

echo "🚀 Starting Joinery AI ML Service..."
echo "📍 Environment: ${APP_ENV:-production}"
echo "🔧 Models directory: ${MODELS_DIR:-./models}"

# Quick database check (non-blocking)
if [ -n "$DATABASE_URL" ]; then
    echo "�️  Database URL configured: ✅ Yes"
    # Test DB connection in background to avoid blocking startup
    (python -c "
import os, psycopg
try:
    conn = psycopg.connect(os.getenv('DATABASE_URL'), connect_timeout=5)
    conn.close()
    print('✅ Database connection successful')
except Exception as e:
    print(f'⚠️  Database connection failed: {e}')
" 2>/dev/null || echo "⚠️  Database connection failed") &
else
    echo "🗄️  Database URL configured: ⚠️  No (email training disabled)"
fi

# Pre-load critical modules to speed up first requests
echo "📦 Pre-loading ML modules..."
python -c "
import sys
try:
    import numpy, pandas, sklearn, joblib
    print('✅ Core ML libraries loaded')
except ImportError as e:
    print(f'⚠️  ML library loading issue: {e}')
    sys.exit(1)
" || exit 1

# Start the service with optimized settings for Render
echo "🌟 Starting ML service on port ${PORT:-8000}..."

# Use multiple workers if we have enough CPU, otherwise single worker
WORKERS=${WEB_CONCURRENCY:-1}
if [ "$WORKERS" -gt 1 ]; then
    echo "🔧 Starting with $WORKERS workers"
    exec gunicorn main:app -w $WORKERS -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${PORT:-8000} --timeout 120 --preload
else
    echo "🔧 Starting with single worker (optimized for small instances)"
    exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --timeout-keep-alive 120
fi