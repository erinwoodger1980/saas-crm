FROM python:3.11-slim

WORKDIR /app

# Make pip predictable and quiet in CI
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
	PIP_REQUIRE_HASHES=0 \
	PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1

COPY requirements.txt ./requirements.txt
# Upgrade pip first to avoid resolver quirks
RUN python -m pip install --upgrade pip && \
	pip install --no-cache-dir -r requirements.txt

ENV MODELS_DIR=/mnt/models
RUN mkdir -p $MODELS_DIR
VOLUME ["/mnt/models"]

COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Render provides PORT (e.g. 10000). Respect it; default to 8000 for local.
CMD ["./start.sh"]
