#!/usr/bin/env python3
"""
Assign tactical philosophies to clubs from CSV.

Usage:
    python pipeline/84_assign_club_philosophies.py [--dry-run]
"""

from __future__ import annotations

import argparse
import csv
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

CSV_PATH = os.path.join(os.path.dirname(__file__), "club_philosophies.csv")


def main(dry_run: bool = False) -> None:
    # Load philosophy slugs → IDs
    phil_resp = sb.table("tactical_philosophies").select("id, slug").execute()
    phil_map: dict[str, int] = {r["slug"]: r["id"] for r in phil_resp.data}

    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    assigned = 0
    skipped = 0
    errors: list[str] = []

    prefix = "[DRY RUN] " if dry_run else ""
    print(f"{prefix}Assigning philosophies to {len(rows)} clubs...\n")

    for row in rows:
        club_name = row["club_name"].strip()
        slug = row["philosophy_slug"].strip()

        # Look up club by exact name
        club_resp = sb.table("clubs").select("id").eq("clubname", club_name).execute()
        club_id = club_resp.data[0]["id"] if club_resp.data else None
        phil_id = phil_map.get(slug)

        if not club_id:
            errors.append(f"  Club not found: '{club_name}'")
            skipped += 1
            continue
        if not phil_id:
            errors.append(f"  Philosophy not found: '{slug}'")
            skipped += 1
            continue

        phil_name = slug.replace("_", " ").title()
        print(f"  {club_name} → {phil_name}")

        if not dry_run:
            sb.table("clubs").update({"philosophy_id": phil_id}).eq("id", club_id).execute()

        assigned += 1

    print(f"\n{prefix}{assigned} assigned, {skipped} skipped")
    if errors:
        print("\nErrors:")
        for e in errors:
            print(e)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    main(dry_run=args.dry_run)
