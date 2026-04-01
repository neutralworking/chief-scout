#!/bin/bash
# sportsapi_refresh.sh — Daily SportsAPIPro enrichment (free tier: 100 req/day)
# Processes ~30 players per run: search + link + attributes + transfers
# At this rate, 276 Tier 1 players complete in ~9 days.
#
# Usage:
#   ./sportsapi_refresh.sh              # daily batch
#   ./sportsapi_refresh.sh --dry-run    # preview only

set -e
cd "$(dirname "$0")"

DRY_RUN=""
if [ "$1" = "--dry-run" ]; then
    DRY_RUN="--dry-run"
    echo "=== DRY RUN ==="
fi

BATCH=30  # ~90 API calls (2 for attrs + 1 for transfers per player)

echo "=== SportsAPIPro Refresh — $(date) ==="

# 1. Attributes (search + link + fetch) — ~60 calls
echo ""
echo "── Step 1: Attributes (batch of $BATCH) ──"
python3 67_sportsapi_attributes.py --limit $BATCH $DRY_RUN 2>&1 | tail -15

# 2. Transfers for all linked players without existing data — ~30 calls
echo ""
echo "── Step 2: Transfers (batch of $BATCH) ──"
python3 68_sportsapi_transfers.py --limit $BATCH $DRY_RUN 2>&1 | tail -10

echo ""
echo "=== SportsAPIPro Refresh complete — $(date) ==="
