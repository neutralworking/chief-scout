#!/bin/bash
# af_refresh.sh — Daily API-Football full refresh + grade/rating pipeline
# Run daily to maximize Pro plan (7,500 req/day, expires 2026-04-18)
#
# Usage:
#   ./af_refresh.sh              # full refresh
#   ./af_refresh.sh --dry-run    # preview only

set -e
cd "$(dirname "$0")"

DRY_RUN=""
if [ "$1" = "--dry-run" ]; then
    DRY_RUN="--dry-run"
    echo "=== DRY RUN ==="
fi

echo "=== AF Refresh — $(date) ==="

# 1. Ingest all leagues (fresh stats)
echo ""
echo "── Step 1: Ingest all leagues ──"
python3 65_api_football_ingest.py --all-leagues --force $DRY_RUN 2>&1 | tail -20

# 2. Generate grades from AF stats
echo ""
echo "── Step 2: Generate grades ──"
python3 66_api_football_grades.py $DRY_RUN 2>&1 | tail -10

# 3. Recompute ratings
echo ""
echo "── Step 3: Recompute ratings ──"
python3 27_player_ratings.py --force $DRY_RUN 2>&1 | tail -10

# 4. Recompute archetypes
echo ""
echo "── Step 4: Recompute archetypes ──"
python3 37_compute_archetypes.py $DRY_RUN 2>&1 | tail -10

echo ""
echo "=== AF Refresh complete — $(date) ==="
