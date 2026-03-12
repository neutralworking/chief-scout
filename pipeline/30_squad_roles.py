"""
30_squad_roles.py — DOF-level squad role assessment.

Assigns squad roles based on level, peak, trajectory, and position.
Roles: Key Player, Important Player, Rotation, Backup, Youth, Surplus

Logic:
  - Key Player: Elite performers (L>=88) or top-of-position (L>=86 + rising/peak)
  - Important Player: Strong contributors (L>=84) or high-ceiling risers (L>=82, gap>=5)
  - Rotation: Solid squad players (L>=78)
  - Backup: Depth options (L>=73)
  - Youth: Young prospects (L<73, gap>=8)
  - Surplus: Declining with low ceiling, or low level with no growth

Usage:
    python 30_squad_roles.py                  # assign roles
    python 30_squad_roles.py --dry-run        # preview only
"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Auto-assign squad roles")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run


def main():
    import psycopg2
    import psycopg2.extras

    print("30 — Squad Role Assessment")

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Load player data ─────────────────────────────────────────────────
    cur.execute("""
        SELECT
            pp.person_id, pe.name, pp.position, pp.level, pp.peak, pp.overall,
            pp.archetype, ps.squad_role,
            cm.trajectory
        FROM player_profiles pp
        JOIN people pe ON pe.id = pp.person_id
        LEFT JOIN player_status ps ON ps.person_id = pp.person_id
        LEFT JOIN career_metrics cm ON cm.person_id = pp.person_id
        WHERE pp.level IS NOT NULL
    """)
    players = cur.fetchall()
    print(f"  {len(players):,} players with level data")

    # ── Evaluate roles ───────────────────────────────────────────────────
    updates: list[tuple[str, int]] = []  # (role, person_id)
    role_counts: dict[str, int] = defaultdict(int)
    changes: list[tuple[str, str, str, int]] = []  # (name, old, new, level)

    for p in players:
        pid = p["person_id"]
        level = p["level"] or 0
        peak = p["peak"] or 0
        gap = peak - level
        trajectory = p["trajectory"] or ""
        old_role = p["squad_role"] or ""

        # ── Determine role ────────────────────────────────────────────
        if level >= 88:
            role = "Key Player"
        elif level >= 86 and trajectory in ("rising", "peak", ""):
            role = "Key Player"
        elif level >= 86 and trajectory == "declining":
            role = "Important Player"
        elif level >= 84:
            role = "Important Player"
        elif level >= 82 and gap >= 5 and trajectory == "rising":
            # High-ceiling risers who aren't quite there yet
            role = "Important Player"
        elif level >= 78:
            role = "Rotation"
        elif level >= 73:
            if gap >= 8:
                role = "Youth"
            else:
                role = "Backup"
        elif gap >= 8:
            role = "Youth"
        elif level >= 68:
            role = "Backup"
        else:
            role = "Surplus"

        # Declining veterans with no ceiling left
        if trajectory == "declining" and gap <= 1 and level < 82:
            role = "Surplus"

        if role != old_role:
            updates.append((role, pid))
            role_counts[role] += 1
            if level >= 85 or old_role:  # Only log interesting changes
                changes.append((p["name"], old_role, role, level))

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n  Role changes to make: {len(updates):,}")
    print()
    for role, count in sorted(role_counts.items(), key=lambda x: -x[1]):
        print(f"    {role:20} {count:>5}")

    if changes:
        print(f"\n  Notable changes (L>=85 or had existing role):")
        for name, old, new, lvl in sorted(changes, key=lambda x: -x[3])[:40]:
            old_display = old or "(none)"
            print(f"    L={lvl:>2} {name:30} {old_display:>20} → {new}")

    if DRY_RUN:
        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # ── Write ────────────────────────────────────────────────────────────
    if updates:
        # Ensure player_status rows exist
        cur.execute("""
            INSERT INTO player_status (person_id)
            SELECT pp.person_id FROM player_profiles pp
            LEFT JOIN player_status ps ON ps.person_id = pp.person_id
            WHERE ps.person_id IS NULL AND pp.level IS NOT NULL
            ON CONFLICT DO NOTHING
        """)
        inserted = cur.rowcount
        if inserted:
            print(f"\n  Created {inserted:,} missing player_status rows")

        from psycopg2.extras import execute_batch
        execute_batch(cur, """
            UPDATE player_status SET squad_role = %s WHERE person_id = %s
        """, updates)

        conn.commit()
        print(f"\n  Updated {len(updates):,} squad roles")
    else:
        print("\n  No role changes needed")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
