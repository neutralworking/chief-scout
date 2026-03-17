"""
38_infer_personality.py — Heuristic personality inference from attribute grades + position.

Infers MBTI-style dimensions (ei/sn/tf/jp 0-100), competitiveness (1-10), and
coachability (1-10) from a player's attribute grades, position, and archetype.

No LLM needed — uses weighted attribute mappings calibrated against 104 manually-scored players.

Usage:
    python 38_infer_personality.py --dry-run        # preview
    python 38_infer_personality.py                  # apply
    python 38_infer_personality.py --force           # overwrite existing
    python 38_infer_personality.py --player 123      # single player
    python 38_infer_personality.py --calibrate       # show calibration vs manual scores
"""
from __future__ import annotations

import argparse
import sys

import psycopg2

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Infer personality from attributes")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true", help="Overwrite existing personality")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
parser.add_argument("--calibrate", action="store_true", help="Compare vs manual scores")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

# ── Personality dimension heuristics ──────────────────────────────────────────
# Each dimension is scored 0-100 based on weighted attribute combinations.
#
# ei: Analytical (high) vs Instinctive (low)
#   High ei (analytical): discipline, awareness, positioning, interceptions, pass_accuracy
#   Low ei (instinctive): take_ons, skills, creativity, acceleration, aggression
#
# sn: Extrinsic (high) vs Intrinsic (low)
#   High sn (extrinsic): pace, acceleration, movement, stamina, pressing, intensity
#   Low sn (intrinsic): pass_accuracy, through_balls, awareness, discipline, positioning
#
# tf: Soloist (high) vs Leader (low)
#   Neutral by default (55), adjusted by position/archetype
#   High tf (soloist): dribbler/sprinter archetypes, WF/CF positions
#   Low tf (leader): commander/controller archetypes, DM/CM positions, high discipline
#
# jp: Competitor (high) vs Composer (low)
#   High jp (competitor): aggression, duels, pressing, intensity, heading
#   Low jp (composer): creativity, through_balls, skills, first_touch, balance

# Attribute weights for each dimension
# Format: {attribute: weight} — positive means pushes score UP, negative pushes DOWN

EI_WEIGHTS = {
    # Analytical (high ei)
    "discipline": 3.0, "awareness": 2.5, "positioning": 2.5,
    "interceptions": 2.0, "pass_accuracy": 2.0, "pass_range": 1.5,
    "concentration": 2.0, "decisions": 2.0, "composure": 1.5,
    # Instinctive (low ei)
    "take_ons": -2.5, "skills": -2.0, "creativity": -2.0,
    "acceleration": -1.5, "aggression": -1.5, "movement": -1.0,
}

SN_WEIGHTS = {
    # Extrinsic (high sn)
    "pace": 2.5, "acceleration": 2.5, "movement": 2.0,
    "stamina": 2.0, "pressing": 2.0, "intensity": 2.0,
    "carries": 1.5, "take_ons": 1.5,
    # Intrinsic (low sn)
    "pass_accuracy": -2.5, "through_balls": -2.0, "awareness": -2.0,
    "discipline": -2.0, "positioning": -1.5, "composure": -1.5,
    "vision": -2.0,
}

JP_WEIGHTS = {
    # Competitor (high jp)
    "aggression": 3.0, "duels": 2.5, "pressing": 2.0,
    "intensity": 2.0, "heading": 1.5, "tackling": 2.0,
    "stamina": 1.5, "aerial_duels": 1.5, "shielding": 1.0,
    # Composer (low jp)
    "creativity": -3.0, "through_balls": -2.5, "skills": -2.0,
    "first_touch": -2.0, "balance": -1.5, "vision": -2.0,
    "composure": -1.5,
}

# tf is mostly position/archetype driven, with light attribute influence
TF_WEIGHTS = {
    # Soloist (high tf)
    "take_ons": 1.5, "skills": 1.5, "carries": 1.0,
    # Leader (low tf)
    "discipline": -1.5, "awareness": -1.0, "pass_accuracy": -1.0,
    "interceptions": -1.0,
}

# Archetype adjustments to tf dimension
TF_ARCHETYPE_MODS = {
    "Controller": -10, "Commander": -15, "Cover": -5,
    "Destroyer": 5, "Passer": -10,
    "Dribbler": 10, "Sprinter": 5, "Striker": 5,
    "Creator": 0, "Engine": 0, "Target": 0,
    "GK": -5, "GK-Controller": -10,
}

# Position adjustments to tf
TF_POSITION_MODS = {
    "GK": -5, "CD": -5, "WD": 0, "DM": -5,
    "CM": -5, "WM": 5, "AM": 5, "WF": 10, "CF": 5,
}

# Competitiveness heuristic: aggression + duels + pressing + intensity
COMP_ATTRS = ["aggression", "duels", "pressing", "intensity", "tackling", "stamina"]

# Coachability heuristic: discipline + awareness + positioning (inverted aggression)
COACH_ATTRS = ["discipline", "awareness", "positioning", "pass_accuracy", "composure"]
COACH_NEG_ATTRS = ["aggression"]


def get_grade(grades: dict, attr: str) -> float | None:
    """Get best available grade for an attribute (prefer scout, fall back to stat)."""
    entry = grades.get(attr)
    if not entry:
        # Try alternate names
        alternates = {"take_ons": "takeons", "takeons": "take_ons"}
        alt = alternates.get(attr)
        if alt:
            entry = grades.get(alt)
    if not entry:
        return None
    # Prefer scout_grade, fall back to stat_score
    if entry["scout"] is not None:
        return entry["scout"]
    if entry["stat"] is not None:
        return entry["stat"]
    return None


def compute_dimension(grades: dict, weights: dict, base: float = 50.0) -> int:
    """Compute a personality dimension (0-100) from weighted attributes."""
    total_weight = 0.0
    score = 0.0

    for attr, weight in weights.items():
        grade = get_grade(grades, attr)
        if grade is None:
            continue
        # Normalize grade to 0-1 scale (grades are 0-20)
        normalized = grade / 20.0
        # Positive weight: high grade → high score
        # Negative weight: high grade → low score
        if weight > 0:
            score += normalized * weight
        else:
            score += (1.0 - normalized) * abs(weight)
        total_weight += abs(weight)

    if total_weight == 0:
        return int(base)

    # Scale to 0-100 centered around base
    raw = score / total_weight  # 0-1
    result = base + (raw - 0.5) * 60  # spread ±30 around base
    return max(0, min(100, int(round(result))))


def compute_tf(grades: dict, position: str | None, archetype: str | None) -> int:
    """Compute tf dimension with position/archetype modifiers."""
    base = compute_dimension(grades, TF_WEIGHTS, base=55.0)

    # Apply archetype modifier
    if archetype:
        primary = archetype.split("-")[0] if "-" in archetype else archetype
        mod = TF_ARCHETYPE_MODS.get(primary, 0)
        base += mod

    # Apply position modifier
    if position:
        mod = TF_POSITION_MODS.get(position, 0)
        base += mod

    return max(0, min(100, base))


def compute_competitiveness(grades: dict) -> int:
    """Compute competitiveness 1-10 from combat/intensity attributes."""
    vals = []
    for attr in COMP_ATTRS:
        g = get_grade(grades, attr)
        if g is not None:
            vals.append(g)
    if not vals:
        return 7  # default
    avg = sum(vals) / len(vals)
    # Map 0-20 grade → 1-10 competitiveness
    return max(1, min(10, int(round(avg / 2.0))))


def compute_coachability(grades: dict) -> int:
    """Compute coachability 1-10 from discipline/tactical attributes."""
    pos_vals = []
    for attr in COACH_ATTRS:
        g = get_grade(grades, attr)
        if g is not None:
            pos_vals.append(g)
    neg_vals = []
    for attr in COACH_NEG_ATTRS:
        g = get_grade(grades, attr)
        if g is not None:
            neg_vals.append(g)

    if not pos_vals:
        return 7  # default

    avg_pos = sum(pos_vals) / len(pos_vals)
    avg_neg = sum(neg_vals) / len(neg_vals) if neg_vals else 10.0  # neutral

    # High discipline + low aggression = high coachability
    raw = avg_pos - (avg_neg * 0.3)
    return max(1, min(10, int(round(raw / 2.0))))


# ── Main ──────────────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

print("38 — Infer Personality from Attributes")

# Load attribute grades per player (best grade per attribute)
cur.execute("""
    SELECT ag.player_id, ag.attribute,
           MAX(ag.scout_grade) as scout_grade,
           MAX(ag.stat_score) as stat_score
    FROM attribute_grades ag
    GROUP BY ag.player_id, ag.attribute
""")
all_grades: dict[int, dict] = {}
for pid, attr, scout, stat in cur.fetchall():
    if pid not in all_grades:
        all_grades[pid] = {}
    attr_lower = attr.lower()
    # Keep best of existing or new
    existing = all_grades[pid].get(attr_lower)
    if existing:
        if scout is not None and (existing["scout"] is None or scout > existing["scout"]):
            existing["scout"] = scout
        if stat is not None and (existing["stat"] is None or stat > existing["stat"]):
            existing["stat"] = stat
    else:
        all_grades[pid][attr_lower] = {"scout": scout, "stat": stat}

print(f"  {len(all_grades)} players with attribute grades")

# ── Calibration mode ──────────────────────────────────────────────────────────
if args.calibrate:
    cur.execute("""
        SELECT py.person_id, p.name, pp.position, pp.archetype,
               py.ei, py.sn, py.tf, py.jp, py.competitiveness, py.coachability
        FROM player_personality py
        JOIN people p ON p.id = py.person_id
        JOIN player_profiles pp ON pp.person_id = p.id
        ORDER BY p.name
    """)
    manual = cur.fetchall()
    print(f"\n── Calibration against {len(manual)} manual records ──")

    errors = {"ei": [], "sn": [], "tf": [], "jp": [], "comp": [], "coach": []}
    for pid, name, pos, arch, m_ei, m_sn, m_tf, m_jp, m_comp, m_coach in manual:
        grades = all_grades.get(pid, {})
        if not grades:
            continue

        i_ei = compute_dimension(grades, EI_WEIGHTS)
        i_sn = compute_dimension(grades, SN_WEIGHTS)
        i_tf = compute_tf(grades, pos, arch)
        i_jp = compute_dimension(grades, JP_WEIGHTS)
        i_comp = compute_competitiveness(grades)
        i_coach = compute_coachability(grades)

        errors["ei"].append(abs(i_ei - m_ei))
        errors["sn"].append(abs(i_sn - m_sn))
        errors["tf"].append(abs(i_tf - m_tf))
        errors["jp"].append(abs(i_jp - m_jp))
        errors["comp"].append(abs(i_comp - m_comp))
        errors["coach"].append(abs(i_coach - m_coach))

        print(f"  {name:30s}  ei:{m_ei:3d}→{i_ei:3d}  sn:{m_sn:3d}→{i_sn:3d}  "
              f"tf:{m_tf:3d}→{i_tf:3d}  jp:{m_jp:3d}→{i_jp:3d}  "
              f"comp:{m_comp}→{i_comp}  coach:{m_coach}→{i_coach}")

    print(f"\n  Mean absolute error:")
    for dim, errs in errors.items():
        if errs:
            print(f"    {dim:6s}: {sum(errs)/len(errs):.1f} (n={len(errs)})")

    cur.close()
    conn.close()
    sys.exit(0)

# ── Inference mode ────────────────────────────────────────────────────────────

# Get players needing personality
where_parts = ["ag_count.cnt >= 5"]  # need at least 5 attributes
if not FORCE:
    where_parts.append("py.person_id IS NULL")
if args.player:
    where_parts.append(f"p.id = {args.player}")

where_clause = "WHERE " + " AND ".join(where_parts)

cur.execute(f"""
    SELECT p.id, p.name, pp.position, pp.archetype
    FROM people p
    JOIN player_profiles pp ON pp.person_id = p.id
    JOIN (
        SELECT player_id, count(DISTINCT attribute) as cnt
        FROM attribute_grades
        GROUP BY player_id
    ) ag_count ON ag_count.player_id = p.id
    LEFT JOIN player_personality py ON py.person_id = p.id
    {where_clause}
    ORDER BY p.name
""")
players = cur.fetchall()
print(f"  {len(players)} players to infer personality for")

if not players:
    print("  Nothing to do.")
    cur.close()
    conn.close()
    sys.exit(0)

updated = 0
skipped = 0

for pid, name, position, archetype in players:
    grades = all_grades.get(pid, {})
    if len(grades) < 5:
        skipped += 1
        continue

    ei = compute_dimension(grades, EI_WEIGHTS)
    sn = compute_dimension(grades, SN_WEIGHTS)
    tf = compute_tf(grades, position, archetype)
    jp = compute_dimension(grades, JP_WEIGHTS)
    comp = compute_competitiveness(grades)
    coach = compute_coachability(grades)

    if DRY_RUN and updated < 30:
        print(f"  {name:35s} ei={ei:3d} sn={sn:3d} tf={tf:3d} jp={jp:3d} comp={comp} coach={coach}")

    if not DRY_RUN:
        cur.execute("""
            INSERT INTO player_personality (person_id, ei, sn, tf, jp, competitiveness, coachability)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (person_id) DO UPDATE SET
                ei = EXCLUDED.ei, sn = EXCLUDED.sn, tf = EXCLUDED.tf, jp = EXCLUDED.jp,
                competitiveness = EXCLUDED.competitiveness, coachability = EXCLUDED.coachability
        """, (pid, ei, sn, tf, jp, comp, coach))

    updated += 1

print(f"\n  Inferred: {updated}")
print(f"  Skipped (too few grades): {skipped}")

if DRY_RUN:
    print("\n  --dry-run: no writes.")

cur.close()
conn.close()
print("Done.")
