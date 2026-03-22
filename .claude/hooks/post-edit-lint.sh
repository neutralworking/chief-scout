#!/bin/bash
# Auto-lint after file edits
# Reads the edited file path from hook environment
FILE="$CLAUDE_FILE_PATH"

if [ -z "$FILE" ]; then
  exit 0
fi

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx)
    # Run eslint fix silently — don't block on errors
    cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
    if [ -f "apps/web/node_modules/.bin/eslint" ]; then
      apps/web/node_modules/.bin/eslint --fix "$FILE" 2>/dev/null
    elif command -v npx &>/dev/null; then
      npx eslint --fix "$FILE" 2>/dev/null
    fi
    ;;
  *.py)
    if command -v ruff &>/dev/null; then
      ruff format "$FILE" 2>/dev/null
      ruff check --fix "$FILE" 2>/dev/null
    fi
    ;;
esac
exit 0
