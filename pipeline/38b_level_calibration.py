"""
38b_level_calibration.py — Algorithmic level calibration from data scores + club strength.

Proposes level corrections by blending:
  1. Data average: (overall + role_score) / 2 — strongest signal
  2. Club anchor: club power_rating mapped to expected level range
  3. Current level: editorial prior (don't swing too aggressively)

Weights shift by grade count — more grades = more trust in data.

Only proposes corrections when gap > threshold (default 3).

Usage:
    python 38b_level_calibration.py --dry-run          # preview only
    python 38b_level_calibration.py --dry-run --min-gap 5  # only big gaps
    python 38b_level_calibration.py                    # apply corrections
    python 38b_level_calibration.py --player 12345     # single player
    python 38b_level_calibration.py --export           # CSV export only
"""
import argparse
import csv
import math
import sys

from config import POSTGRES_DSN
from lib.db import require_conn, get_supabase

parser = argparse.ArgumentParser(description="Algorithmic level calibration")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--player", type=int, help="Single person_id")
parser.add_argument("--min-gap", type=int, default=3, help="Minimum gap to propose correction (default 3)")
parser.add_argument("--min-grades", type=int, default=10, help="Minimum grades required (default 10)")
parser.add_argument("--export", action="store_true", help="Export CSV only, don't write")
parser.add_argument("--force", action="store_true", help="Apply even to scout-assessed players")
args = parser.parse_args()

conn = require_conn(autocommit=True)
sb = get_supabase()
cur = conn.cursor()


# ── Club anchor: map power_rating to an expected level range ────────────────
# A club's power_rating (22-87) maps to a level floor for squad players.
# Stars at top clubs can be well above this; bench players sit near it.
# This isn't a prediction — it's a sanity check. A Chicago Fire player
# can be good but is unlikely to be 86.

def club_anchor(power_rating):
    """Map club power_rating (22-87) to an expected squad-level anchor.

    Calibrated from actual avg levels:
      Real Madrid (87) → avg 81.5, so anchor ~82
      Arsenal (77) → avg 79.8, so anchor ~80
      Bochum (76) → avg 77, so anchor ~77
      Monza (72) → avg 75, so anchor ~75
      Luton (73) → avg 76, so anchor ~76

    Linear fit: anchor ≈ power * 0.4 + 47
    Clamped to 72-84 (don't let club alone push levels extreme).
    """
    if power_rating is None:
        return None
    anchor = float(power_rating) * 0.4 + 47
    return max(72, min(84, anchor))


def compute_suggested_level(current_level, overall, role_score, grade_count,
                            club_power=None, has_scout_grades=False,
                            season_rating=None):
    """Compute a suggested level from data + club + prior.

    The blend weights shift by data confidence (grade count):
    - 50+ grades: 55% data, 15% club, 30% prior
    - 20 grades:  40% data, 15% club, 45% prior
    - 10 grades:  25% data, 15% club, 60% prior

    If no club power, its weight redistributes to prior.
    """
    # Role score maps directly to the user's level scale.
    # RS 84 ≈ level 84. Don't overthink it.
    #
    # Season rating nudges up/down from there:
    #   7.5+ season → performing above RS, nudge up
    #   6.5- season → underperforming, nudge down
    #   No season data → trust RS as-is
    base = role_score

    if season_rating is not None:
        sr = float(season_rating)
        # Only nudge UP for strong seasons — don't penalize bench/rotation players.
        # A player's ability doesn't decrease because they're not starting.
        # 7.3+ season = performing above RS, nudge up (each 0.1 above 7.3 = +0.3)
        if sr > 7.3:
            nudge = (sr - 7.3) * 3.0
            nudge = min(3, nudge)  # cap at +3
            base = round(base + nudge)

    return base


# ── Load data ───────────────────────────────────────────────────────────────

print("Level Calibration Engine")
print(f"  Dry run: {args.dry_run}")
print(f"  Min gap: {args.min_gap}")
print(f"  Min grades: {args.min_grades}")

where = ""
params = []
if args.player:
    where = "AND p.id = %s"
    params = [args.player]

cur.execute(f"""
    SELECT p.id, p.name, pp.position, pp.level, pp.overall, pp.best_role_score,
        pp.best_role,
        (SELECT COUNT(*) FROM attribute_grades ag WHERE ag.player_id = p.id) as gc,
        (SELECT COUNT(*) FROM attribute_grades ag
         WHERE ag.player_id = p.id AND ag.source = 'scout_assessment') as scout_gc,
        c.power_rating, c.clubname, c.league_name,
        (SELECT afs.rating FROM api_football_player_stats afs
         WHERE afs.person_id = p.id AND afs.season = '2025'
           AND afs.minutes > 450
         ORDER BY afs.minutes DESC LIMIT 1) as season_rating
    FROM people p
    JOIN player_profiles pp ON pp.person_id = p.id
    LEFT JOIN clubs c ON c.id = p.club_id
    WHERE pp.level IS NOT NULL
      AND pp.overall IS NOT NULL
      AND pp.best_role_score IS NOT NULL
      {where}
    ORDER BY pp.level DESC
""", params)

rows = cur.fetchall()
cols = [d[0] for d in cur.description]
print(f"  Players with level + overall + role_score: {len(rows)}")

# ── Compute suggestions ────────────────────────────────────────────────────

corrections = []
stats = {"total": 0, "proposed": 0, "up": 0, "down": 0, "skipped_scout": 0}

for row in rows:
    d = dict(zip(cols, row))
    stats["total"] += 1

    has_scout = d["scout_gc"] > 0
    if has_scout and not args.force:
        stats["skipped_scout"] += 1
        continue

    suggested = compute_suggested_level(
        current_level=d["level"],
        overall=int(d["overall"]),
        role_score=d["best_role_score"],
        grade_count=d["gc"],
        club_power=d["power_rating"],
        has_scout_grades=has_scout,
        season_rating=d["season_rating"],
    )

    gap = abs(suggested - d["level"])
    if gap < args.min_gap:
        continue
    if d["gc"] < args.min_grades:
        continue

    direction = "↑" if suggested > d["level"] else "↓"
    if suggested > d["level"]:
        stats["up"] += 1
    else:
        stats["down"] += 1
    stats["proposed"] += 1

    corrections.append({
        "person_id": d["id"],
        "name": d["name"],
        "position": d["position"],
        "current_level": d["level"],
        "suggested_level": suggested,
        "gap": d["level"] - suggested,
        "overall": int(d["overall"]),
        "role_score": d["best_role_score"],
        "role": d["best_role"] or "",
        "grades": d["gc"],
        "club": d["clubname"] or "",
        "league": d["league_name"] or "",
        "direction": direction,
    })

# ── Output ──────────────────────────────────────────────────────────────────

print(f"\n  Proposed corrections: {stats['proposed']} ({stats['down']} down, {stats['up']} up)")
print(f"  Skipped (scout-assessed): {stats['skipped_scout']}")

if corrections:
    # Show sample
    print(f"\n  Top 20 corrections by gap:")
    print(f"  {'Name':28s} {'Pos':3s} {'Lvl':>3s} → {'Sug':>3s}  {'Ovr':>3s} {'RS':>3s} {'Grd':>3s}  Club")
    print(f"  {'-'*95}")
    for c in sorted(corrections, key=lambda x: abs(x["gap"]), reverse=True)[:20]:
        print(f"  {c['name']:28s} {c['position']:3s} {c['current_level']:3d} {c['direction']} {c['suggested_level']:3d}"
              f"  {c['overall']:3d} {c['role_score']:3d} {c['grades']:3d}  {c['club']}")

# ── Export CSV ──────────────────────────────────────────────────────────────

if args.export or args.dry_run:
    csv_path = "level_calibration.csv"
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "person_id", "name", "position", "current_level", "suggested_level",
            "gap", "overall", "role_score", "role", "grades", "club", "league",
        ])
        w.writeheader()
        for c in sorted(corrections, key=lambda x: abs(x["gap"]), reverse=True):
            w.writerow({k: v for k, v in c.items() if k != "direction"})
    print(f"\n  Exported {len(corrections)} rows to {csv_path}")

# ── Apply ───────────────────────────────────────────────────────────────────

if not args.dry_run and not args.export and corrections:
    updates = [{"person_id": c["person_id"], "level": c["suggested_level"]}
               for c in corrections]

    for i in range(0, len(updates), 200):
        chunk = updates[i:i + 200]
        sb.table("player_profiles").upsert(chunk, on_conflict="person_id").execute()

    print(f"\n  Applied {len(updates)} level corrections")

elif args.dry_run:
    print(f"\n  [dry-run] would apply {len(corrections)} corrections")

# ── Summary ─────────────────────────────────────────────────────────────────

print(f"\n── Summary ───────────────────────────────────────────────────────")
print(f"  Total players:       {stats['total']}")
print(f"  Proposed:            {stats['proposed']}")
print(f"  Down:                {stats['down']}")
print(f"  Up:                  {stats['up']}")
print(f"  Skipped (scout):     {stats['skipped_scout']}")
if corrections:
    avg_gap = sum(abs(c["gap"]) for c in corrections) / len(corrections)
    print(f"  Avg gap:             {avg_gap:.1f}")
print("Done.")

cur.close()
conn.close()
