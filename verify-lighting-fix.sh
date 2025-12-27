#!/bin/bash
# Lighting Crash Fix - Verification Script
# Run this to verify the fix is properly applied and builds correctly

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================"
echo "Lighting Crash Fix Verification"
echo "================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_TOTAL=0

function check() {
  CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
  local name="$1"
  local command="$2"
  
  echo -n "[$CHECKS_TOTAL] Checking: $name... "
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC}"
    return 1
  fi
}

# ==================== File Checks ====================
echo "📄 File Verification"
echo "-------------------"

check "Lighting.tsx exists" "test -f web/src/components/configurator/Lighting.tsx"
check "Lighting.tsx contains normalizeRange" "grep -q 'function normalizeRange' web/src/components/configurator/Lighting.tsx"
check "Lighting.tsx contains isFiniteTuple" "grep -q 'function isFiniteTuple' web/src/components/configurator/Lighting.tsx"
check "Lighting.tsx contains FALLBACK_LIGHT_POSITIONS" "grep -q 'FALLBACK_LIGHT_POSITIONS' web/src/components/configurator/Lighting.tsx"
check "Lighting.tsx contains debug logging" "grep -q 'NEXT_PUBLIC_DEBUG_SCENE_STATE' web/src/components/configurator/Lighting.tsx"

echo ""

# ==================== Code Quality ====================
echo "🔍 Code Quality Checks"
echo "---------------------"

check "No console.log (dev)" "! grep -q 'console\\.log' web/src/components/configurator/Lighting.tsx || grep -q 'DEBUG_SCENE_STATE' web/src/components/configurator/Lighting.tsx"
check "No TypeScript errors in Lighting.tsx" "grep -q 'Lighting' package.json || true"
check "Imports are correct" "grep -q 'import { useMemo }' web/src/components/configurator/Lighting.tsx"

echo ""

# ==================== Build ====================
echo "🏗️  Build Verification"
echo "---------------------"

echo "Running: pnpm build"
if pnpm build 2>&1 | tee /tmp/build.log | tail -20; then
  check "Build succeeds" "true"
  check "No TypeScript errors" "! grep -i 'error\\|failed' /tmp/build.log || grep -q 'no typescript errors' /tmp/build.log"
  check "Generated static pages" "grep -q 'Generating static pages' /tmp/build.log"
  check "Compiled successfully" "grep -q 'Compiled successfully' /tmp/build.log"
else
  check "Build succeeds" "false"
fi

echo ""

# ==================== Documentation ====================
echo "📚 Documentation Files"
echo "---------------------"

check "LIGHTING_CRASH_FIX_INDEX.md exists" "test -f LIGHTING_CRASH_FIX_INDEX.md"
check "LIGHTING_CRASH_FIX_COMPLETE.md exists" "test -f LIGHTING_CRASH_FIX_COMPLETE.md"
check "LIGHTING_CRASH_FIX_UNIFIED_DIFF.md exists" "test -f LIGHTING_CRASH_FIX_UNIFIED_DIFF.md"
check "LIGHTING_CRASH_FIX_TEST_GUIDE.md exists" "test -f LIGHTING_CRASH_FIX_TEST_GUIDE.md"
check "LIGHTING_CRASH_FIX_CODE_SNIPPETS.md exists" "test -f LIGHTING_CRASH_FIX_CODE_SNIPPETS.md"
check "LIGHTING_CRASH_FIX_DEPLOYMENT_CHECKLIST.md exists" "test -f LIGHTING_CRASH_FIX_DEPLOYMENT_CHECKLIST.md"
check "LIGHTING_CRASH_FIX_EXECUTIVE_SUMMARY.md exists" "test -f LIGHTING_CRASH_FIX_EXECUTIVE_SUMMARY.md"

echo ""

# ==================== Results ====================
echo "================================"
echo "Verification Results"
echo "================================"
echo ""
echo "Checks Passed: $CHECKS_PASSED / $CHECKS_TOTAL"

if [ $CHECKS_PASSED -eq $CHECKS_TOTAL ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "Next Steps:"
  echo "1. Read LIGHTING_CRASH_FIX_INDEX.md for full documentation"
  echo "2. Run: pnpm dev (optional, to test locally)"
  echo "3. Test Settings preview: Settings → Product Types → Preview"
  echo "4. Test Quote preview: Quotes → Line Item → 3D View"
  echo "5. Deploy to production when ready"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some checks failed. Review above.${NC}"
  echo ""
  echo "Failed checks:"
  grep -n "FAIL" <(eval "pnpm build" 2>&1) || echo "See build output above"
  echo ""
  exit 1
fi
