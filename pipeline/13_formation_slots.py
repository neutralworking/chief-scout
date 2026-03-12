#!/usr/bin/env python3
"""
13_formation_slots.py — Populate formation_slots with role-assigned slots.

Each slot in a formation now has a named tactical role (e.g. Regista, Inside Forward)
instead of just a position code. Roles link to the tactical_roles table which
defines archetype affinity for player-role fit scoring.

Usage:
    python 13_formation_slots.py [--dry-run]

Requires migration 018_tactical_roles.sql to be applied first.
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
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Inverted Full-Back", "RB"),
        ("DM", "Anchor", "LDM"),
        ("DM", "Regista", "RDM"),
        ("AM", "Trequartista", "CAM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Complete Forward", "ST"),
    ],
    # ── 4-3-3 ─────────────────────────────────────────────────────────────────
    "4-3-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Inverted Full-Back", "RB"),
        ("DM", "Regista", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Complete Forward", "ST"),
    ],
    # ── 4-4-2 ─────────────────────────────────────────────────────────────────
    "4-4-2": [
        ("GK", "Shot Stopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Overlapping Full-Back", "RB"),
        ("CM", "Box-to-Box", "LCM"),
        ("CM", "Deep Playmaker", "RCM"),
        ("WM", "Traditional Winger", "LM"),
        ("WM", "Traditional Winger", "RM"),
        ("CF", "Target Man", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-4-1-1 ───────────────────────────────────────────────────────────────
    "4-4-1-1": [
        ("GK", "Shot Stopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Overlapping Full-Back", "RB"),
        ("CM", "Box-to-Box", "LCM"),
        ("CM", "Deep Playmaker", "RCM"),
        ("WM", "Traditional Winger", "LM"),
        ("WM", "Traditional Winger", "RM"),
        ("AM", "Shadow Striker", "CAM"),
        ("CF", "Target Man", "ST"),
    ],
    # ── 4-1-2-1-2 ────────────────────────────────────────────────────────────
    "4-1-2-1-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Ball-Playing CB", "RCB"),
        ("WD", "Inverted Full-Back", "LB"),
        ("WD", "Inverted Full-Back", "RB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Mezzala", "RCM"),
        ("AM", "Advanced Playmaker", "CAM"),
        ("CF", "Complete Forward", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-2-2-2 ───────────────────────────────────────────────────────────────
    "4-2-2-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Overlapping Full-Back", "RB"),
        ("DM", "Regista", "LDM"),
        ("DM", "Anchor", "RDM"),
        ("AM", "Advanced Playmaker", "LAM"),
        ("AM", "Shadow Striker", "RAM"),
        ("CF", "Target Man", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-1-3-2 ───────────────────────────────────────────────────────────────
    "4-1-3-2": [
        ("GK", "Shot Stopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Overlapping Full-Back", "RB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Box-to-Box", "CM"),
        ("WM", "Wide Playmaker", "LM"),
        ("WM", "Traditional Winger", "RM"),
        ("CF", "Target Man", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-2-1-3 ───────────────────────────────────────────────────────────────
    "4-2-1-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Ball-Playing CB", "RCB"),
        ("WD", "Inverted Full-Back", "LB"),
        ("WD", "Inverted Full-Back", "RB"),
        ("DM", "Regista", "LDM"),
        ("DM", "Anchor", "RDM"),
        ("AM", "Trequartista", "CAM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "False 9", "ST"),
    ],
    # ── 4-3-1-2 ───────────────────────────────────────────────────────────────
    "4-3-1-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Inverted Full-Back", "RB"),
        ("DM", "Regista", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("AM", "Trequartista", "CAM"),
        ("CF", "Complete Forward", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-3-2-1 ───────────────────────────────────────────────────────────────
    "4-3-2-1": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Inverted Full-Back", "RB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Deep Playmaker", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("WF", "Wide Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Complete Forward", "ST"),
    ],
    # ── 4-2-4 ─────────────────────────────────────────────────────────────────
    "4-2-4": [
        ("GK", "Shot Stopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Overlapping Full-Back", "RB"),
        ("CM", "Box-to-Box", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("WF", "Wide Forward", "LW"),
        ("WF", "Wide Forward", "RW"),
        ("CF", "Target Man", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 4-5-1 ─────────────────────────────────────────────────────────────────
    "4-5-1": [
        ("GK", "Shot Stopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "RCB"),
        ("WD", "Overlapping Full-Back", "LB"),
        ("WD", "Overlapping Full-Back", "RB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Box-to-Box", "LCM"),
        ("CM", "Deep Playmaker", "RCM"),
        ("WM", "Traditional Winger", "LM"),
        ("WM", "Traditional Winger", "RM"),
        ("CF", "Target Man", "ST"),
    ],
    # ── 4-6-0 ─────────────────────────────────────────────────────────────────
    "4-6-0": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Ball-Playing CB", "RCB"),
        ("WD", "Inverted Full-Back", "LB"),
        ("WD", "Inverted Full-Back", "RB"),
        ("DM", "Regista", "LDM"),
        ("DM", "Deep Playmaker", "RDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Mezzala", "RCM"),
        ("AM", "Trequartista", "LAM"),
        ("AM", "Advanced Playmaker", "RAM"),
    ],
    # ── 3-4-3 ─────────────────────────────────────────────────────────────────
    "3-4-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Ball-Playing CB", "RCB"),
        ("WM", "Wing-Back", "LWB"),
        ("WM", "Wing-Back", "RWB"),
        ("CM", "Box-to-Box", "LCM"),
        ("CM", "Deep Playmaker", "RCM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Complete Forward", "ST"),
    ],
    # ── 3-5-2 ─────────────────────────────────────────────────────────────────
    "3-5-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Stopper", "RCB"),
        ("WM", "Wing-Back", "LWB"),
        ("WM", "Wing-Back", "RWB"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("AM", "Trequartista", "CAM"),
        ("CF", "Target Man", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 3-4-2-1 ───────────────────────────────────────────────────────────────
    "3-4-2-1": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Ball-Playing CB", "RCB"),
        ("WM", "Wing-Back", "LWB"),
        ("WM", "Wing-Back", "RWB"),
        ("CM", "Deep Playmaker", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("AM", "Advanced Playmaker", "LAM"),
        ("AM", "Shadow Striker", "RAM"),
        ("CF", "Complete Forward", "ST"),
    ],
    # ── 3-4-1-2 ───────────────────────────────────────────────────────────────
    "3-4-1-2": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Stopper", "RCB"),
        ("WM", "Wing-Back", "LWB"),
        ("WM", "Wing-Back", "RWB"),
        ("CM", "Box-to-Box", "LCM"),
        ("CM", "Mezzala", "RCM"),
        ("AM", "Trequartista", "CAM"),
        ("CF", "Target Man", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 5-3-2 ─────────────────────────────────────────────────────────────────
    "5-3-2": [
        ("GK", "Shot Stopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Wing-Back", "LWB"),
        ("WD", "Wing-Back", "RWB"),
        ("DM", "Anchor", "CDM"),
        ("CM", "Box-to-Box", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("CF", "Target Man", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 5-4-1 ─────────────────────────────────────────────────────────────────
    "5-4-1": [
        ("GK", "Shot Stopper", "GK"),
        ("CD", "Stopper", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Stopper", "RCB"),
        ("WD", "Wing-Back", "LWB"),
        ("WD", "Wing-Back", "RWB"),
        ("CM", "Box-to-Box", "LCM"),
        ("CM", "Deep Playmaker", "RCM"),
        ("WM", "Traditional Winger", "LM"),
        ("WM", "Traditional Winger", "RM"),
        ("CF", "Target Man", "ST"),
    ],
    # ── 5-2-3 ─────────────────────────────────────────────────────────────────
    "5-2-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Ball-Playing CB", "RCB"),
        ("WD", "Wing-Back", "LWB"),
        ("WD", "Wing-Back", "RWB"),
        ("CM", "Deep Playmaker", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "Complete Forward", "ST"),
    ],
    # ── 3-3-4 ─────────────────────────────────────────────────────────────────
    "3-3-4": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Ball-Playing CB", "RCB"),
        ("DM", "Regista", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Mezzala", "RCM"),
        ("WF", "Wide Forward", "LW"),
        ("WF", "Wide Forward", "RW"),
        ("CF", "Complete Forward", "LST"),
        ("CF", "Poacher", "RST"),
    ],
    # ── 3-3-1-3 ───────────────────────────────────────────────────────────────
    "3-3-1-3": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Ball-Playing CB", "RCB"),
        ("DM", "Regista", "CDM"),
        ("CM", "Mezzala", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("AM", "Trequartista", "CAM"),
        ("WF", "Inside Forward", "LW"),
        ("WF", "Inside Forward", "RW"),
        ("CF", "False 9", "ST"),
    ],
    # ── 3-6-1 ─────────────────────────────────────────────────────────────────
    "3-6-1": [
        ("GK", "Sweeper Keeper", "GK"),
        ("CD", "Ball-Playing CB", "LCB"),
        ("CD", "Sweeper", "CCB"),
        ("CD", "Ball-Playing CB", "RCB"),
        ("WM", "Wing-Back", "LWB"),
        ("WM", "Wing-Back", "RWB"),
        ("CM", "Deep Playmaker", "LCM"),
        ("CM", "Box-to-Box", "RCM"),
        ("AM", "Advanced Playmaker", "LAM"),
        ("AM", "Shadow Striker", "RAM"),
        ("CF", "Target Man", "ST"),
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

    # Fetch tactical roles for ID lookup
    result = sb.table("tactical_roles").select("id, name, position").execute()
    role_lookup = {(r["name"], r["position"]): r["id"] for r in result.data}
    print(f"Found {len(role_lookup)} tactical roles in database")

    if not role_lookup:
        print("ERROR: No tactical roles found. Run migration 018_tactical_roles.sql first.")
        sys.exit(1)

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
                role_id = role_lookup.get((role, pos))
                status = "OK" if role_id else "MISSING"
                print(f"    {label:6s} {pos:3s} → {role} [{status}]")
        else:
            sb.table("formations").update({
                "era": era,
                "position_count": len(slots),
            }).eq("id", fid).execute()

            for pos, role, label in slots:
                role_id = role_lookup.get((role, pos))
                if not role_id:
                    print(f"  WARNING: role '{role}' for position '{pos}' not found in tactical_roles")
                rows_to_insert.append({
                    "formation_id": fid,
                    "position": pos,
                    "slot_count": 1,  # each row is now one slot
                    "slot_label": label,
                    "role_id": role_id,
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
