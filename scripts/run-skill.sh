#!/usr/bin/env bash
# run-skill.sh — Run a Claude Code skill headlessly
# Usage: ./scripts/run-skill.sh <skill> [prompt] [max-turns]
#
# Examples:
#   ./scripts/run-skill.sh pipeline
#   ./scripts/run-skill.sh pipeline "ingest StatsBomb competition 43" 10
#   ./scripts/run-skill.sh scout "flag Priority players with expiring contracts"

set -euo pipefail

SKILL="${1:?Usage: run-skill.sh <skill> [prompt] [max-turns]}"
PROMPT="${2:-}"
MAX_TURNS="${3:-5}"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/scripts/logs"
mkdir -p "$LOG_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/${SKILL}_${TIMESTAMP}.log"

# Build the prompt
if [ -n "$PROMPT" ]; then
  FULL_PROMPT="Run /$SKILL -- $PROMPT"
else
  FULL_PROMPT="Run /$SKILL"
fi

echo "[$TIMESTAMP] Running /$SKILL (max $MAX_TURNS turns)" | tee "$LOG_FILE"
echo "Prompt: $FULL_PROMPT" | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

claude -p "$FULL_PROMPT" \
  --max-turns "$MAX_TURNS" \
  2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=${PIPESTATUS[0]}

echo "---" | tee -a "$LOG_FILE"
echo "[$TIMESTAMP] /$SKILL finished (exit=$EXIT_CODE)" | tee -a "$LOG_FILE"

exit $EXIT_CODE
