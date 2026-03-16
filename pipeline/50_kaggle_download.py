"""
50_kaggle_download.py — Download all Kaggle datasets for Chief Scout pipeline.

Downloads 5 datasets and extracts them into imports/kaggle/ subdirectories.

Prerequisites:
    pip install kaggle
    # Set up ~/.kaggle/kaggle.json with your API credentials
    # OR set KAGGLE_USERNAME and KAGGLE_KEY environment variables

Usage:
    python 50_kaggle_download.py              # download all
    python 50_kaggle_download.py --dataset 1  # download only dataset 1
    python 50_kaggle_download.py --force       # re-download even if exists
    python 50_kaggle_download.py --list        # just list datasets
"""
import argparse
import subprocess
import sys
from pathlib import Path

from config import IMPORTS_DIR

# ── CLI ───────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Download Kaggle datasets for Chief Scout")
parser.add_argument("--dataset", type=int, help="Download only specific dataset (1-5)")
parser.add_argument("--force", action="store_true", help="Re-download even if directory has files")
parser.add_argument("--list", action="store_true", help="Just list datasets")
args = parser.parse_args()

# ── Dataset registry ──────────────────────────────────────────────────────────

DATASETS = [
    {
        "id": 1,
        "slug": "kaanyorgun/european-top-leagues-player-stats-25-26",
        "dir": "euro_leagues",
        "name": "European Top Leagues Player Stats 25-26",
        "script": "45_kaggle_euro_leagues.py",
        "url": "https://www.kaggle.com/datasets/kaanyorgun/european-top-leagues-player-stats-25-26",
    },
    {
        "id": 2,
        "slug": "kanchana1990/football-transfer-value-intelligence-2024",
        "dir": "transfer_values",
        "name": "Football Transfer Value Intelligence",
        "script": "46_kaggle_transfer_values.py",
        "url": "https://www.kaggle.com/datasets/kanchana1990/football-transfer-value-intelligence-2024",
    },
    {
        "id": 3,
        "slug": "zkskhurram/fifa-and-football-complete-dataset-19302022",
        "dir": "fifa_historical",
        "name": "FIFA & Football Complete Dataset 1930-2022",
        "script": "47_kaggle_fifa_historical.py",
        "url": "https://www.kaggle.com/datasets/zkskhurram/fifa-and-football-complete-dataset-19302022",
    },
    {
        "id": 4,
        "slug": "furkanark/premier-league-2024-2025-data",
        "dir": "pl_stats",
        "name": "Premier League 2024-2025 Data",
        "script": "48_kaggle_pl_stats.py",
        "url": "https://www.kaggle.com/datasets/furkanark/premier-league-2024-2025-data",
    },
    {
        "id": 5,
        "slug": "sananmuzaffarov/european-football-injuries-2020-2025",
        "dir": "injuries",
        "name": "European Football Injuries 2020-2025",
        "script": "49_kaggle_injuries.py --tags --traits",
        "url": "https://www.kaggle.com/datasets/sananmuzaffarov/european-football-injuries-2020-2025",
    },
]

KAGGLE_DIR = IMPORTS_DIR / "kaggle"

# ── List mode ─────────────────────────────────────────────────────────────────

if args.list:
    print("\n=== Kaggle Datasets for Chief Scout ===\n")
    for ds in DATASETS:
        target = KAGGLE_DIR / ds["dir"]
        status = "✓ downloaded" if target.exists() and any(target.glob("*.csv")) else "✗ not found"
        print(f"  [{ds['id']}] {ds['name']}")
        print(f"      Slug:   {ds['slug']}")
        print(f"      Dir:    imports/kaggle/{ds['dir']}/")
        print(f"      Script: {ds['script']}")
        print(f"      Status: {status}")
        print()
    sys.exit(0)

# ── Check kaggle CLI ─────────────────────────────────────────────────────────

try:
    result = subprocess.run(["kaggle", "--version"], capture_output=True, text=True)
    if result.returncode != 0:
        raise FileNotFoundError
    print(f"Kaggle CLI: {result.stdout.strip()}")
except FileNotFoundError:
    print("ERROR: kaggle CLI not found. Install with: pip install kaggle")
    print("Then set up credentials: https://github.com/Kaggle/kaggle-api#api-credentials")
    sys.exit(1)

# ── Download ──────────────────────────────────────────────────────────────────

print("\n=== Downloading Kaggle Datasets ===\n")

datasets_to_download = DATASETS
if args.dataset:
    datasets_to_download = [d for d in DATASETS if d["id"] == args.dataset]
    if not datasets_to_download:
        print(f"ERROR: Dataset {args.dataset} not found (valid: 1-5)")
        sys.exit(1)

success = 0
failed = 0

for ds in datasets_to_download:
    target = KAGGLE_DIR / ds["dir"]
    target.mkdir(parents=True, exist_ok=True)

    existing = list(target.glob("*.csv")) + list(target.glob("*.CSV"))
    if existing and not args.force:
        print(f"[{ds['id']}] {ds['name']} — already has {len(existing)} CSV file(s), skipping (use --force)")
        success += 1
        continue

    print(f"[{ds['id']}] Downloading {ds['name']}...")
    print(f"    kaggle datasets download -d {ds['slug']} --unzip -p {target}")

    try:
        result = subprocess.run(
            ["kaggle", "datasets", "download", "-d", ds["slug"], "--unzip", "-p", str(target)],
            capture_output=True, text=True, timeout=300,
        )
        if result.returncode == 0:
            csv_count = len(list(target.glob("*.csv")) + list(target.glob("*.CSV")))
            print(f"    ✓ Downloaded — {csv_count} CSV file(s)")
            success += 1
        else:
            print(f"    ✗ Failed: {result.stderr.strip()[:200]}")
            failed += 1
    except subprocess.TimeoutExpired:
        print(f"    ✗ Timed out after 5 minutes")
        failed += 1
    except Exception as e:
        print(f"    ✗ Error: {e}")
        failed += 1

# ── Summary ───────────────────────────────────────────────────────────────────

print(f"\n=== Summary ===")
print(f"  Downloaded: {success}/{len(datasets_to_download)}")
if failed:
    print(f"  Failed:     {failed}")

print(f"\n=== Next Steps ===")
print(f"  Run all ingests:    make kaggle-all")
print(f"  Or individually:")
for ds in datasets_to_download:
    target = KAGGLE_DIR / ds["dir"]
    has_files = any(target.glob("*.csv"))
    marker = "✓" if has_files else "✗"
    print(f"    {marker} cd pipeline && python {ds['script']}")
