#!/usr/bin/env python3
"""
13_formation_slots.py — Populate formation_slots table with position mappings.

Maps each formation to our position enum (GK, CD, WD, DM, CM, WM, AM, WF, CF)
with slot counts. Also sets era and position_count on formations table.

Usage:
    python 13_formation_slots.py [--dry-run]
"""

import argparse
import os
import sys

from supabase import create_client

# Position enum: GK, CD, WD, DM, CM, WM, AM, WF, CF
# Formation → { position: count }
# GK is always 1 and omitted for brevity (added automatically)

FORMATION_SLOTS: dict[str, dict[str, int]] = {
    # Modern 4-back
    "4-2-3-1": {"CD": 2, "WD": 2, "DM": 2, "AM": 1, "WF": 2, "CF": 1},
    "4-3-3": {"CD": 2, "WD": 2, "DM": 1, "CM": 2, "WF": 2, "CF": 1},
    "4-4-2": {"CD": 2, "WD": 2, "CM": 2, "WM": 2, "CF": 2},
    "4-4-1-1": {"CD": 2, "WD": 2, "CM": 2, "WM": 2, "AM": 1, "CF": 1},
    "4-1-2-1-2": {"CD": 2, "WD": 2, "DM": 1, "CM": 2, "AM": 1, "CF": 2},
    "4-2-2-2": {"CD": 2, "WD": 2, "DM": 2, "AM": 2, "CF": 2},
    "4-1-3-2": {"CD": 2, "WD": 2, "DM": 1, "CM": 1, "WM": 2, "CF": 2},
    "4-2-1-3": {"CD": 2, "WD": 2, "DM": 2, "AM": 1, "WF": 2, "CF": 1},
    "4-3-1-2": {"CD": 2, "WD": 2, "CM": 2, "DM": 1, "AM": 1, "CF": 2},
    "4-3-2-1": {"CD": 2, "WD": 2, "CM": 2, "DM": 1, "WF": 2, "CF": 1},
    "4-2-4": {"CD": 2, "WD": 2, "CM": 2, "WF": 2, "CF": 2},
    "4-5-1": {"CD": 2, "WD": 2, "DM": 1, "CM": 2, "WM": 2, "CF": 1},
    "4-6-0": {"CD": 2, "WD": 2, "DM": 2, "CM": 2, "AM": 2},

    # Modern 3-back / 5-back
    "3-4-3": {"CD": 3, "WM": 2, "CM": 2, "WF": 2, "CF": 1},
    "3-5-2": {"CD": 3, "WM": 2, "CM": 2, "AM": 1, "CF": 2},
    "3-4-2-1": {"CD": 3, "WM": 2, "CM": 2, "AM": 2, "CF": 1},
    "3-4-1-2": {"CD": 3, "WM": 2, "CM": 2, "AM": 1, "CF": 2},
    "5-3-2": {"CD": 3, "WD": 2, "CM": 2, "DM": 1, "CF": 2},
    "5-4-1": {"CD": 3, "WD": 2, "CM": 2, "WM": 2, "CF": 1},
    "5-2-3": {"CD": 3, "WD": 2, "CM": 2, "WF": 2, "CF": 1},
    "3-3-4": {"CD": 3, "CM": 2, "DM": 1, "WF": 2, "CF": 2},
    "3-3-1-3": {"CD": 3, "CM": 2, "DM": 1, "AM": 1, "WF": 2, "CF": 1},
    "3-6-1": {"CD": 3, "WM": 2, "CM": 2, "AM": 2, "CF": 1},
}

# Era classification
MODERN = {
    "4-2-3-1", "4-3-3", "4-4-2", "4-4-1-1", "4-1-2-1-2", "4-2-2-2",
    "4-1-3-2", "4-2-1-3", "4-3-1-2", "4-3-2-1", "4-5-1", "4-6-0",
    "3-4-3", "3-5-2", "3-4-2-1", "3-4-1-2",
    "5-3-2", "5-4-1", "5-2-3", "3-3-4", "3-3-1-3", "3-6-1",
    "4-2-4",
}


def main():
    parser = argparse.ArgumentParser(description="Populate formation_slots")
    parser.add_argument("--dry-run", action="store_true", help="Print without writing")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required")
        sys.exit(1)

    sb = create_client(url, key)

    # Fetch existing formations
    result = sb.table("formations").select("id, name, structure").execute()
    formations = {f["name"]: f for f in result.data}
    print(f"Found {len(formations)} formations in database")

    matched = 0
    skipped = 0
    rows_to_insert = []

    for name, slots in FORMATION_SLOTS.items():
        # Try exact match, then try with structure field
        formation = formations.get(name)
        if not formation:
            # Try matching by structure
            for f in formations.values():
                if f["structure"] == name:
                    formation = f
                    break

        if not formation:
            print(f"  SKIP: '{name}' not found in formations table")
            skipped += 1
            continue

        fid = formation["id"]
        era = "modern" if name in MODERN else "classic"
        total_outfield = sum(slots.values())

        if args.dry_run:
            print(f"  {name} (id={fid}): {slots} | era={era}, positions={total_outfield + 1}")
        else:
            # Update era and position_count
            sb.table("formations").update({
                "era": era,
                "position_count": total_outfield + 1  # +1 for GK
            }).eq("id", fid).execute()

            # Upsert slots (GK always 1)
            all_slots = {"GK": 1, **slots}
            for pos, count in all_slots.items():
                rows_to_insert.append({
                    "formation_id": fid,
                    "position": pos,
                    "slot_count": count,
                })

        matched += 1

    if not args.dry_run and rows_to_insert:
        # Delete existing slots for these formations, then insert
        fids = list({r["formation_id"] for r in rows_to_insert})
        for fid in fids:
            sb.table("formation_slots").delete().eq("formation_id", fid).execute()
        sb.table("formation_slots").insert(rows_to_insert).execute()

    print(f"\nDone: {matched} mapped, {skipped} skipped")
    if args.dry_run:
        print("(dry run — no changes written)")


if __name__ == "__main__":
    main()
