#!/bin/bash
# Full FBRef pipeline: ingest saved pages → match → grades → refine
# Usage: ./run_fbref_pipeline.sh [--dry-run]

set -e
cd "$(dirname "$0")"

DRY_RUN=""
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN="--dry-run"
    echo "=== DRY RUN MODE ==="
fi

echo ""
echo "=== Step 1: Ingest FBRef HTML pages ==="
python3 11_fbref_ingest.py $DRY_RUN

echo ""
echo "=== Step 2: Match FBRef players to people ==="
python3 10_player_matching.py --source fbref $DRY_RUN

echo ""
echo "=== Step 3: Generate attribute grades from FBRef stats ==="
python3 22_fbref_grades.py $DRY_RUN

echo ""
echo "=== Step 4: Re-score archetypes ==="
python3 04_refine_players.py $DRY_RUN

echo ""
echo "=== Pipeline complete ==="
