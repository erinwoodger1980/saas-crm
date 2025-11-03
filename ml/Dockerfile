FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PDF processing
RUN apt-get update && apt-get install -y \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Make pip predictable and quiet in CI
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
	PIP_REQUIRE_HASHES=0 \
	PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	MODELS_DIR=/mnt/models

# Create models directory
RUN mkdir -p $MODELS_DIR

# Copy and install Python dependencies first (for better Docker layer caching)
COPY requirements.txt ./
RUN python -m pip install --upgrade pip && \
	pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Health check to help Render detect when service is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Default port for Render (will be overridden by $PORT env var)
EXPOSE 8000

# Use startup script
CMD ["./start.sh"]
