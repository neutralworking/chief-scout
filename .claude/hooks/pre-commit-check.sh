#!/bin/bash
# Pre-commit: type-check staged TS files + format Python
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

STAGED_TS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$')
STAGED_PY=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$')

ERRORS=0

# TypeScript check
if [ -n "$STAGED_TS" ]; then
  if [ -f "apps/web/tsconfig.json" ]; then
    cd apps/web
    npx tsc --noEmit 2>&1 | tail -5
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
      echo "⚠ TypeScript errors found"
      ERRORS=1
    fi
    cd ../..
  fi
fi

# Python format check
if [ -n "$STAGED_PY" ] && command -v ruff &>/dev/null; then
  ruff check $STAGED_PY 2>&1 | head -10
  if [ $? -ne 0 ]; then
    echo "⚠ Ruff lint issues (auto-fixing)"
    ruff check --fix $STAGED_PY 2>/dev/null
    ruff format $STAGED_PY 2>/dev/null
    git add $STAGED_PY
  fi
fi

exit $ERRORS
