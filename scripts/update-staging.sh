#!/usr/bin/env bash

# Update + Sync Script: push latest to main, then refresh staging DB from production
# Usage:
#   ./scripts/update-staging.sh                # interactive, with confirmations
#   ./scripts/update-staging.sh --auto         # non-interactive, proceed without prompts
#   ./scripts/update-staging.sh --skip-git     # skip git push step, only DB sync
#   ./scripts/update-staging.sh --confirm      # explicitly confirm actions
#
# Requirements:
# - Homebrew installed (for postgresql@17 client if not present)
# - Access to production and staging PostgreSQL via Render
# - PROD_DATABASE_URL and STAGING_DATABASE_URL available, OR resolvable from env files

set -euo pipefail

AUTO=false
SKIP_GIT=false
CONFIRM=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --auto) AUTO=true ;;
    --skip-git) SKIP_GIT=true ;;
    --confirm) CONFIRM=true ;;
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown option: $arg" && exit 2 ;;
  esac
done

log() { printf "\033[1m%s\033[0m\n" "$1"; }
info() { echo "• $1"; }
err()  { echo "❌ $1" >&2; }
ok()   { echo "✅ $1"; }

# Ensure we're at repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

log "Update + Staging Sync"
info "Repo: $REPO_ROOT"

# Source private secrets if present (not committed)
SECRETS_FILE="$REPO_ROOT/.secrets/update-staging.env"
if [ -f "$SECRETS_FILE" ]; then
  info "Loading private DB URLs from .secrets/update-staging.env"
  set -a
  # shellcheck source=/dev/null
  . "$SECRETS_FILE"
  set +a
  # When secrets are present, default to auto-confirm unless overridden
  if [ "$AUTO" = false ]; then AUTO=true; fi
  if [ "$CONFIRM" = false ]; then CONFIRM=true; fi
fi

# 1) Git push main
if [ "$SKIP_GIT" = false ]; then
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  info "Current branch: $CURRENT_BRANCH"
  if [ "$CURRENT_BRANCH" != "main" ]; then
    err "You are not on 'main' (found: $CURRENT_BRANCH). Switch to main first or pass --skip-git."
    exit 1
  fi

  # Check clean working tree
  if ! git diff --quiet || ! git diff --cached --quiet; then
    err "Working tree has uncommitted changes. Commit or stash before continuing."
    exit 1
  fi

  # Pull + push
  log "Pushing latest to origin/main"
  if [ "$DRY_RUN" = true ]; then
    info "[dry-run] git pull --rebase && git push origin main"
  else
    git pull --rebase
    git push origin main
  fi
  ok "Main branch pushed"
else
  info "Skipping git push (per --skip-git)"
fi

# 2) Resolve DB URLs
resolve_env_var() {
  # $1 = file path, $2 = var name
  local file="$1"; local var="$2"
  if [ -f "$file" ]; then
    # Extract first matching assignment; tolerate quotes
    grep -E "^${var}=" "$file" | head -1 | sed -E 's/^'"$var"'=//; s/^"//; s/"$//'
  fi
}

# Prefer environment variables; else fall back to files
PROD_DB="${PROD_DATABASE_URL:-}"
STAGING_DB="${STAGING_DATABASE_URL:-}"

if [ -z "$PROD_DB" ]; then
  # Try api/.env then .env.local
  PROD_DB=$(resolve_env_var "$REPO_ROOT/api/.env" DATABASE_URL)
  [ -z "$PROD_DB" ] && PROD_DB=$(resolve_env_var "$REPO_ROOT/.env.local" DATABASE_URL)
fi

if [ -z "$STAGING_DB" ]; then
  STAGING_DB=$(resolve_env_var "$REPO_ROOT/api/.staging.env" DATABASE_URL)
  [ -z "$STAGING_DB" ] && STAGING_DB=$(resolve_env_var "$REPO_ROOT/api/.env" STAGING_DATABASE_URL)
fi

if [ -z "$PROD_DB" ] || [ -z "$STAGING_DB" ]; then
  err "Could not resolve PROD/STAGING database URLs. Set PROD_DATABASE_URL and STAGING_DATABASE_URL or update api/.env and api/.staging.env."
  exit 1
fi

# Normalize to include sslmode=require, appending with ? or & appropriately
normalize_sslmode() {
  local url="$1"
  if [[ "$url" == *"sslmode="* ]]; then echo "$url"; return; fi
  if [[ "$url" == *"?"* ]]; then echo "${url}&sslmode=require"; else echo "${url}?sslmode=require"; fi
}
PROD_DB="$(normalize_sslmode "$PROD_DB")"
STAGING_DB="$(normalize_sslmode "$STAGING_DB")"

log "Database URLs"
info "PROD:    ${PROD_DB%%@*}@…/${PROD_DB##*/}"
info "STAGING: ${STAGING_DB%%@*}@…/${STAGING_DB##*/}"

# Confirm destructive operation
if [ "$AUTO" = false ] && [ "$CONFIRM" = false ]; then
  read -r -p "Proceed to overwrite STAGING with PROD data? [y/N] " yn
  case "$yn" in
    [Yy]*) ;; 
    *) err "Cancelled"; exit 1 ;;
  esac
fi

# 3) Ensure PostgreSQL client v17 available
if [ "$DRY_RUN" = false ] && ! command -v pg_dump >/dev/null 2>&1; then
  log "Installing postgresql@17 client via Homebrew"
  brew install postgresql@17
fi
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

# 4) Migrate: pg_dump (stdout only) | psql
if [ "$DRY_RUN" = true ]; then
  log "[dry-run] Would export PROD and import to STAGING"
  info "[dry-run] pg_dump --clean --if-exists --no-owner --no-privileges \"$PROD_DB\" | psql \"$STAGING_DB\""
else
  log "Exporting production DB → Importing to staging (this may take minutes)"
  # Use options to avoid ownership/privileges errors on import
  set +e
  pg_dump --clean --if-exists --no-owner --no-privileges "$PROD_DB" | psql "$STAGING_DB"
  MIG_STATUS=$?
  set -e

  if [ "$MIG_STATUS" -ne 0 ]; then
    err "Migration failed (exit $MIG_STATUS)."
    echo "Tips:"
    echo " - Verify DB URLs include the Render region host (e.g., .oregon-postgres.render.com)"
    echo " - Ensure network access/IP allowlists permit connections from this machine"
    exit $MIG_STATUS
  fi

  ok "Staging DB refreshed from production"
fi

# 5) Quick verification (best-effort – may vary by schema)
log "Verifying: count tables in public schema"
if [ "$DRY_RUN" = true ]; then
  info "[dry-run] Would run verification query"
else
  psql "$STAGING_DB" -c "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='public';" || true
fi

ok "Update + sync completed"
