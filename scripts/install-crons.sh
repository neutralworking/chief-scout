#!/usr/bin/env bash
# install-crons.sh — Install all Chief Scout cron jobs
# Usage: ./scripts/install-crons.sh
#
# Adds cron entries without duplicating if already installed.
# Run `crontab -l` to verify, `crontab -r` to remove all.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

CRONS="
# Chief Scout — automated skills
0 2 * * * $PROJECT_DIR/scripts/cron-pipeline.sh      # Daily pipeline at 2 AM
0 6 * * * $PROJECT_DIR/scripts/cron-qa-check.sh       # Daily QA at 6 AM
0 9 * * 1 $PROJECT_DIR/scripts/cron-scout-report.sh   # Weekly scout report Monday 9 AM
"

# Check for existing entries to avoid duplicates
EXISTING=$(crontab -l 2>/dev/null || true)

if echo "$EXISTING" | grep -q "Chief Scout"; then
  echo "Chief Scout crons already installed. Current entries:"
  echo "$EXISTING" | grep -A1 "Chief Scout"
  echo ""
  echo "To reinstall, run: crontab -r && ./scripts/install-crons.sh"
  exit 0
fi

# Append to existing crontab
(echo "$EXISTING"; echo "$CRONS") | crontab -

echo "Installed Chief Scout cron jobs:"
echo "$CRONS"
echo ""
echo "Verify with: crontab -l"
