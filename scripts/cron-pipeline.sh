#!/usr/bin/env bash
# cron-pipeline.sh — Daily pipeline ingestion
# Cron: 0 2 * * * /path/to/chief-scout/scripts/cron-pipeline.sh
#
# Runs the full data pipeline: parse → push → statsbomb → understat
# Logs output to scripts/logs/

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

LOG_DIR="$PROJECT_DIR/scripts/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/pipeline_$(date +%Y%m%d-%H%M%S).log"

echo "[$(date)] Starting daily pipeline" | tee "$LOG_FILE"

claude -p "Run /pipeline -- full pipeline: parse, insert, enrich, refine, valuation, dof, push. Use --dry-run first, then run for real if dry run passes. Also ingest StatsBomb and Understat if migration 003 is ready." \
  --max-turns 15 \
  2>&1 | tee -a "$LOG_FILE"

echo "[$(date)] Pipeline complete (exit=${PIPESTATUS[0]})" | tee -a "$LOG_FILE"
