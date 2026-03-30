#!/usr/bin/env python3
"""
25_formation_slots.py — Populate formation_slots with position-assigned slots.

Each slot in a formation has a position code and a slot label (LCB, RCB, etc.).
Role assignments now live in the systems hierarchy (tactical_systems → system_slots → slot_roles).

Usage:
    python 25_formation_slots.py [--dry-run]
"""

import argparse
import os
import sys

from supabase import create_client

# ── Formation slot definitions ────────────────────────────────────────────────
# Each formation maps to a list of (position, role_name, slot_label) tuples.
# slot_label is a short positional tag (LCB, RCB, LWF, etc.) for display.
# GK is always included as slot 1.

FORMATION_ROLES: dict[str, list[tuple[str, str, str]]] = {
    # ── 4-2-3-1 ──────────────────────────────────────────────────────────────
    "4-2-3-1": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Invertido", "RB"),
        ("DM", "Anchor", "LDM"),
        ("DM", "Regista", "RDM"),
        ("AM", "Trequartista", "CAM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Poacher", "ST"),
    ],
    # ── 4-3-3 ─────────────────────────────────────────────────────────────────
    "4-3-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Invertido", "RB"),
        ("DM", "Regista", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Poacher", "ST"),
    ],
    # ── 4-4-2 ─────────────────────────────────────────────────────────────────
    "4-4-2": [
        ("GK", "Shotstopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Lateral", "RB"),
        ("CM", "Tuttocampista", "LCM"),
        ("CM", "Metodista", "RCM"),
        ("WM", "Winger", "LM"),
        ("WM", "Winger", "RM"),
        ("CF", "Prima Punta", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-4-1-1 ───────────────────────────────────────────────────────────────
    "4-4-1-1": [
        ("GK", "Shotstopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Lateral", "RB"),
        ("CM", "Tuttocampista", "LCM"),
        ("CM", "Metodista", "RCM"),
        ("WM", "Winger", "LM"),
        ("WM", "Winger", "RM"),
        ("AM", "Seconda Punta", "CAM"),
        ("CF", "Prima Punta", "ST"),
    ],
    # ── 4-1-2-1-2 ────────────────────────────────────────────────────────────
    "4-1-2-1-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Libero", "RCB"),
        ("WD", "Invertido", "LB"),
        ("WD", "Invertido", "RB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Mezzala", "RCM"),
        ("AM", "Enganche", "CAM"),
        ("CF", "Poacher", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-2-2-2 ───────────────────────────────────────────────────────────────
    "4-2-2-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Lateral", "RB"),
        ("DM", "Regista", "LDM"),
        ("DM", "Anchor", "RDM"),
        ("AM", "Enganche", "LAM"),
        ("AM", "Seconda Punta", "RAM"),
        ("CF", "Prima Punta", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-1-3-2 ───────────────────────────────────────────────────────────────
    "4-1-3-2": [
        ("GK", "Shotstopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Lateral", "RB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Tuttocampista", "CM"),
        ("WM", "False Winger", "LM"),
        ("WM", "Winger", "RM"),
        ("CF", "Prima Punta", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-2-1-3 ───────────────────────────────────────────────────────────────
    "4-2-1-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Libero", "RCB"),
        ("WD", "Invertido", "LB"),
        ("WD", "Invertido", "RB"),
        ("DM", "Regista", "LDM"),
        ("DM", "Anchor", "RDM"),
        ("AM", "Trequartista", "CAM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Falso Nove", "ST"),
    ],
    # ── 4-3-1-2 ───────────────────────────────────────────────────────────────
    "4-3-1-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Invertido", "RB"),
        ("DM", "Regista", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("AM", "Trequartista", "CAM"),
        ("CF", "Poacher", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-3-2-1 ───────────────────────────────────────────────────────────────
    "4-3-2-1": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Invertido", "RB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Metodista", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("WF", "Extremo", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Poacher", "ST"),
    ],
    # ── 4-2-4 ─────────────────────────────────────────────────────────────────
    "4-2-4": [
        ("GK", "Shotstopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Lateral", "RB"),
        ("CM", "Tuttocampista", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("WF", "Extremo", "LW"),
        ("WF", "Extremo", "RW"),
        ("CF", "Prima Punta", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-5-1 ─────────────────────────────────────────────────────────────────
    "4-5-1": [
        ("GK", "Shotstopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "RCB"),
        ("WD", "Lateral", "LB"),
        ("WD", "Lateral", "RB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Tuttocampista", "LCM"),
        ("CM", "Metodista", "RCM"),
        ("WM", "Winger", "LM"),
        ("WM", "Winger", "RM"),
        ("CF", "Prima Punta", "ST"),
    ],
    # ── 4-6-0 ─────────────────────────────────────────────────────────────────
    "4-6-0": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Libero", "RCB"),
        ("WD", "Invertido", "LB"),
        ("WD", "Invertido", "RB"),
        ("DM", "Regista", "LDM"),
        ("DM", "Metodista", "RDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Mezzala", "RCM"),
        ("AM", "Trequartista", "LAM"),
        ("AM", "Enganche", "RAM"),
    ],
    # ── 3-4-3 ─────────────────────────────────────────────────────────────────
    "3-4-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Libero", "RCB"),
        ("WM", "Fluidificante", "LWB"),
        ("WM", "Fluidificante", "RWB"),
        ("CM", "Tuttocampista", "LCM"),
        ("CM", "Metodista", "RCM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Poacher", "ST"),
    ],
    # ── 3-5-2 ─────────────────────────────────────────────────────────────────
    "3-5-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Stopper", "RCB"),
        ("WM", "Fluidificante", "LWB"),
        ("WM", "Fluidificante", "RWB"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("AM", "Trequartista", "CAM"),
        ("CF", "Prima Punta", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 3-4-2-1 ───────────────────────────────────────────────────────────────
    "3-4-2-1": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Libero", "RCB"),
        ("WM", "Fluidificante", "LWB"),
        ("WM", "Fluidificante", "RWB"),
        ("CM", "Metodista", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("AM", "Enganche", "LAM"),
        ("AM", "Seconda Punta", "RAM"),
        ("CF", "Poacher", "ST"),
    ],
    # ── 3-4-1-2 ───────────────────────────────────────────────────────────────
    "3-4-1-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Stopper", "RCB"),
        ("WM", "Fluidificante", "LWB"),
        ("WM", "Fluidificante", "RWB"),
        ("CM", "Tuttocampista", "LCM"),
        ("CM", "Mezzala", "RCM"),
        ("AM", "Trequartista", "CAM"),
        ("CF", "Prima Punta", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 5-3-2 ─────────────────────────────────────────────────────────────────
    "5-3-2": [
        ("GK", "Shotstopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Fluidificante", "LWB"),
        ("WD", "Fluidificante", "RWB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Tuttocampista", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("CF", "Prima Punta", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 5-4-1 ─────────────────────────────────────────────────────────────────
    "5-4-1": [
        ("GK", "Shotstopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Fluidificante", "LWB"),
        ("WD", "Fluidificante", "RWB"),
        ("CM", "Tuttocampista", "LCM"),
        ("CM", "Metodista", "RCM"),
        ("WM", "Winger", "LM"),
        ("WM", "Winger", "RM"),
        ("CF", "Prima Punta", "ST"),
    ],
    # ── 5-2-3 ─────────────────────────────────────────────────────────────────
    "5-2-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Libero", "RCB"),
        ("WD", "Fluidificante", "LWB"),
        ("WD", "Fluidificante", "RWB"),
        ("CM", "Metodista", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Poacher", "ST"),
    ],
    # ── 3-3-4 ─────────────────────────────────────────────────────────────────
    "3-3-4": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Libero", "RCB"),
        ("DM", "Regista", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Mezzala", "RCM"),
        ("WF", "Extremo", "LW"),
        ("WF", "Extremo", "RW"),
        ("CF", "Poacher", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 3-3-1-3 ───────────────────────────────────────────────────────────────
    "3-3-1-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Libero", "RCB"),
        ("DM", "Regista", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("AM", "Trequartista", "CAM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Falso Nove", "ST"),
    ],
    # ── 3-6-1 ─────────────────────────────────────────────────────────────────
    "3-6-1": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Libero", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Libero", "RCB"),
        ("WM", "Fluidificante", "LWB"),
        ("WM", "Fluidificante", "RWB"),
        ("CM", "Metodista", "LCM"),
        ("CM", "Tuttocampista", "RCM"),
        ("AM", "Enganche", "LAM"),
        ("AM", "Seconda Punta", "RAM"),
        ("CF", "Prima Punta", "ST"),
    ],
}

# Era classification
MODERN = set(FORMATION_ROLES.keys())


def main():
    parser = argparse.ArgumentParser(description="Populate formation_slots with roles")
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

    for name, slots in FORMATION_ROLES.items():
        formation = formations.get(name)
        if not formation:
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

        if args.dry_run:
            print(f"\n  {name} (id={fid}) | era={era}")
            for pos, role, label in slots:
                print(f"    {label:6s} {pos:3s} → {role}")
        else:
            sb.table("formations").update({
                "era": era,
                "position_count": len(slots),
            }).eq("id", fid).execute()

            for pos, role, label in slots:
                rows_to_insert.append({
                    "formation_id": fid,
                    "position": pos,
                    "slot_count": 1,  # each row is now one slot
                    "slot_label": label,
                })

        matched += 1

    if not args.dry_run and rows_to_insert:
        fids = list({r["formation_id"] for r in rows_to_insert})
        for fid in fids:
            sb.table("formation_slots").delete().eq("formation_id", fid).execute()
        # Insert in chunks (Supabase limit)
        for i in range(0, len(rows_to_insert), 50):
            sb.table("formation_slots").insert(rows_to_insert[i:i+50]).execute()

    print(f"\nDone: {matched} formations mapped, {skipped} skipped")
    print(f"Total slots: {len(rows_to_insert)}")
    if args.dry_run:
        print("(dry run — no changes written)")


if __name__ == "__main__":
    main()
