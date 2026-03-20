"""
81_airtable_kc_ingest.py — Pull fake player names from Airtable for Kickoff Clash.

Reads from the "Fake Players" Airtable base (AIRTABLE_OVERFLOW_BASE_ID).
Extracts names + nation for KC character generation.

Output: pipeline/.cache/kc_names.json

Usage:
    python pipeline/81_airtable_kc_ingest.py [--dry-run]
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import CACHE_DIR

CACHE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH = CACHE_DIR / "kc_names.json"

DRY_RUN = "--dry-run" in sys.argv

API_KEY = os.environ.get("AIRTABLE_API_KEY", "")
BASE_ID = os.environ.get("AIRTABLE_OVERFLOW_BASE_ID", "")  # "Fake Players" base


def fetch_all(base_id: str, table: str, fields: list[str]) -> list[dict]:
    records = []
    offset = None
    field_params = "&".join(f"fields%5B%5D={urllib.parse.quote(f)}" for f in fields)
    while True:
        url = f"https://api.airtable.com/v0/{base_id}/{urllib.parse.quote(table)}?pageSize=100&{field_params}"
        if offset:
            url += f"&offset={offset}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {API_KEY}"})
        data = json.loads(urllib.request.urlopen(req).read())
        records.extend(data.get("records", []))
        offset = data.get("offset")
        if not offset:
            break
        time.sleep(0.22)
    return records


def main():
    if not API_KEY or not BASE_ID:
        print("ERROR: AIRTABLE_API_KEY and AIRTABLE_OVERFLOW_BASE_ID must be set")
        sys.exit(1)

    print(f"Fetching fake players from Airtable ({BASE_ID})...")
    records = fetch_all(BASE_ID, "Players", ["Name", "Nation"])
    print(f"  {len(records)} records")

    names = []
    seen = set()
    for rec in records:
        name = (rec.get("fields", {}).get("Name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        nation = rec.get("fields", {}).get("Nation")
        names.append({"name": name, "nation": nation})

    print(f"{len(names)} unique fake names extracted")

    if DRY_RUN:
        print(f"[DRY RUN] Would write to {OUTPUT_PATH}")
        for n in names[:10]:
            print(f"  {n['name']} ({n['nation']})")
        return

    with open(OUTPUT_PATH, "w") as f:
        json.dump(names, f, indent=2, ensure_ascii=False)
    print(f"Wrote to {OUTPUT_PATH}")

    kc_data = Path.home() / "Documents" / "kickoff-clash" / "data"
    if kc_data.exists():
        kc_out = kc_data / "kc_names.json"
        with open(kc_out, "w") as f:
            json.dump(names, f, indent=2, ensure_ascii=False)
        print(f"Copied to {kc_out}")


if __name__ == "__main__":
    main()
