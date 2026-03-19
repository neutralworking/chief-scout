"""
68_af_infer_positions.py — Infer player positions from API-Football stats.

Uses stat patterns to classify players into SACROSANCT positions:
  GK: saves > 0, very low tackles/goals
  CD: high tackles + interceptions, low goals, high passes
  WD: moderate tackles, moderate goals/assists
  DM: high tackles + interceptions + passes
  CM: balanced tackles/passes, moderate goals
  WM: moderate dribbles + pace indicators
  AM: high key passes, moderate goals
  CF: high goals + shots, low tackles
  WF: high dribbles + goals, moderate assists

Only sets position for players that don't already have one.

Usage:
    python 68_af_infer_positions.py [--dry-run] [--verbose]
"""

import argparse
import sys

from lib.db import require_conn

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--verbose", action="store_true")
args = parser.parse_args()


def infer_position(stats: dict) -> str | None:
    """Infer SACROSANCT position from API-Football per-90 stats."""
    apps = stats.get("appearances") or 0
    mins = stats.get("minutes") or 0
    if apps < 3 or mins < 200:
        return None

    goals = (stats.get("goals") or 0)
    assists = (stats.get("assists") or 0)
    shots = (stats.get("shots_total") or 0)
    tackles = (stats.get("tackles_total") or 0)
    interceptions = (stats.get("interceptions") or 0)
    blocks = (stats.get("blocks") or 0)
    passes = (stats.get("passes_total") or 0)
    key_passes = (stats.get("passes_key") or 0)
    dribbles_att = (stats.get("dribbles_attempted") or 0)
    dribbles_won = (stats.get("dribbles_success") or 0)
    duels = (stats.get("duels_total") or 0)

    # Per-90 normalization
    p90 = mins / 90 if mins > 0 else 1
    g90 = goals / p90
    a90 = assists / p90
    tkl90 = tackles / p90
    int90 = interceptions / p90
    pass90 = passes / p90
    kp90 = key_passes / p90
    shot90 = shots / p90
    drib90 = dribbles_att / p90

    # GK: very few tackles, very few goals, low shots
    if tackles <= 2 and goals <= 1 and shots <= 3 and interceptions <= 2 and blocks <= 2:
        if passes > 0:  # GKs still pass
            return "GK"

    # Defender signals
    defensive = tkl90 + int90
    attacking = g90 + a90

    # CF: high goals, high shots, low defensive
    if g90 > 0.35 and shot90 > 2.0 and defensive < 3.0:
        return "CF"

    # WF: high dribbles + goals, moderate
    if drib90 > 2.0 and g90 > 0.2 and defensive < 3.5:
        return "WF"

    # AM: high creativity, moderate goals
    if kp90 > 1.5 and g90 > 0.1 and defensive < 3.5:
        return "AM"

    # WM: moderate dribbles, moderate creativity
    if drib90 > 1.5 and kp90 > 0.8 and defensive < 4.0:
        return "WM"

    # CM: balanced
    if pass90 > 30 and defensive > 2.0 and defensive < 5.0 and g90 < 0.3:
        return "CM"

    # DM: high defensive, high passes, low goals
    if defensive > 4.0 and pass90 > 30 and g90 < 0.15:
        return "DM"

    # CD: very high defensive, high passes, very low goals
    if defensive > 3.5 and g90 < 0.1 and pass90 > 25:
        return "CD"

    # WD: moderate defensive + some attacking contribution
    if defensive > 2.5 and attacking > 0.05 and attacking < 0.4 and pass90 > 20:
        return "WD"

    # Fallback: if very defensive → CD, if attacking → CF
    if defensive > 4.0:
        return "CD"
    if g90 > 0.25:
        return "CF"
    if pass90 > 35:
        return "CM"

    return None


def main():
    conn = require_conn()
    cur = conn.cursor()

    print("68 — Infer positions from API-Football stats")

    # Get AF players without position
    cur.execute("""
        SELECT afs.person_id, p.name, afs.team_name,
               afs.appearances, afs.minutes, afs.goals, afs.assists,
               afs.shots_total, afs.shots_on, afs.passes_total, afs.passes_key,
               afs.passes_accuracy, afs.tackles_total, afs.blocks, afs.interceptions,
               afs.duels_total, afs.duels_won, afs.dribbles_attempted, afs.dribbles_success,
               afs.cards_yellow, afs.cards_red
        FROM api_football_player_stats afs
        JOIN people p ON p.id = afs.person_id
        JOIN player_profiles pp ON pp.person_id = afs.person_id
        WHERE pp.position IS NULL
          AND afs.person_id IS NOT NULL
        ORDER BY afs.appearances DESC
    """)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    print(f"  AF players without position: {len(rows)}")

    updates = []
    pos_counts: dict[str, int] = {}

    for row in rows:
        d = dict(zip(cols, row))
        pid = d["person_id"]
        pos = infer_position(d)
        if pos:
            updates.append((pos, pid))
            pos_counts[pos] = pos_counts.get(pos, 0) + 1
            if args.verbose:
                print(f"    {d['name']:30s} {(d['team_name'] or '-'):20s} → {pos}")

    print(f"  Inferred: {len(updates)}")
    print(f"  Distribution: {dict(sorted(pos_counts.items()))}")
    print(f"  Could not infer: {len(rows) - len(updates)}")

    if args.dry_run:
        print("  [dry-run] No writes.")
    elif updates:
        from psycopg2.extras import execute_batch
        execute_batch(cur, """
            UPDATE player_profiles SET position = %s WHERE person_id = %s AND position IS NULL
        """, updates)
        conn.commit()
        print(f"  Updated {len(updates)} positions")

    conn.close()
    print("  Done.")


if __name__ == "__main__":
    main()
