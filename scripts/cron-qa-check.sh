#!/usr/bin/env bash
# cron-qa-check.sh — Daily data quality check
# Cron: 0 6 * * * /path/to/chief-scout/scripts/cron-qa-check.sh
#
# Validates data integrity across all player tables

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

LOG_DIR="$PROJECT_DIR/scripts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/qa-check_$(date +%Y%m%d-%H%M%S).log"

echo "[$(date)] Starting QA check" | tee "$LOG_FILE"

claude -p "Run /qa-manager -- Daily data quality check:
1. People without player_profiles (orphaned identities)
2. Player_profiles with null position or archetype
3. Player_market rows with missing market_value_tier
4. Duplicate entries in people (same name + dob)
5. player_status rows with no corresponding people record
Report counts and sample IDs for any issues found." \
  --max-turns 8 \
  2>&1 | tee -a "$LOG_FILE"

echo "[$(date)] QA check complete (exit=${PIPESTATUS[0]})" | tee -a "$LOG_FILE"
