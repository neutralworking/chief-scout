#!/usr/bin/env bash
# cron-scout-report.sh — Weekly scouting digest
# Cron: 0 9 * * 1 /path/to/chief-scout/scripts/cron-scout-report.sh
#
# Generates a scouting report: priority targets, expiring contracts, anomalies

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

LOG_DIR="$PROJECT_DIR/scripts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/scout-report_$(date +%Y%m%d-%H%M%S).log"

echo "[$(date)] Starting weekly scout report" | tee "$LOG_FILE"

claude -p "Run /scout -- Generate a weekly scouting digest:
1. List all players with pursuit_status = Priority
2. Flag any players with contract tags suggesting expiry
3. Check for missing or incomplete player_profiles
4. Summarise any new players added in the last 7 days
Output as a structured report." \
  --max-turns 10 \
  2>&1 | tee -a "$LOG_FILE"

echo "[$(date)] Scout report complete (exit=${PIPESTATUS[0]})" | tee -a "$LOG_FILE"
