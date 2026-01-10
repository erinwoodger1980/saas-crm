#!/usr/bin/env bash

# Wrapper to run the full out-of-hours update with no prompts
# Reads DB URLs from .secrets/update-staging.env if present

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

./scripts/update-staging.sh --auto --confirm "$@"

echo "✅ Out-of-hours update completed"
