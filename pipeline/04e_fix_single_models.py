"""
04e_fix_single_models.py — Assign secondary models to players with single-model compounds.

71% of active players level 85+ have only a Primary model (e.g. "Striker" not
"Striker-Creator"). The root cause is pipeline 04's 70% rule requiring the
secondary to be within 70% of the primary score AND from a different category.

This script relaxes the threshold to 50% and re-computes compounds for
single-model players only. It does NOT touch players who already have
dual compounds.

Usage:
    python 04e_fix_single_models.py --dry-run          # preview
    python 04e_fix_single_models.py                    # fix all single-model active lvl 85+
    python 04e_fix_single_models.py --min-level 80     # lower threshold
    python 04e_fix_single_models.py --player 20176     # single player debug
    python 04e_fix_single_models.py --all              # include legends too
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn
from lib.models import MODEL_ATTRIBUTES, SOURCE_PRIORITY, ATTR_ALIASES

parser = argparse.ArgumentParser(description="Fix single-model compounds")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--player", type=int, help="Debug single player")
parser.add_argument("--min-level", type=int, default=85)
parser.add_argument("--all", action="store_true", help="Include legends (active=false)")
parser.add_argument("--threshold", type=float, default=0.50, help="Secondary/primary ratio (default 0.50, was 0.70)")
args = parser.parse_args()

DRY_RUN = args.dry_run

# Model categories — secondary must be from a different category
MODEL_COMPOUNDS = {
    "Controller": "Mental", "Commander": "Mental", "Creator": "Mental",
    "Target": "Physical", "Sprinter": "Physical", "Powerhouse": "Physical",
    "Cover": "Tactical", "Engine": "Tactical", "Destroyer": "Tactical",
    "Dribbler": "Technical", "Passer": "Technical", "Striker": "Technical",
    "GK": "Specialist",
}

# Position affinity tiebreakers (same as pipeline 04)
POS_AFFINITY = {
    "CF": ["Striker", "Target"],
    "WF": ["Dribbler", "Striker", "Creator"],
    "AM": ["Creator", "Dribbler"],
    "CM": ["Controller", "Engine", "Passer"],
    "WM": ["Engine", "Dribbler", "Passer"],
    "DM": ["Cover", "Destroyer", "Controller"],
    "CD": ["Cover", "Destroyer", "Commander"],
    "WD": ["Engine", "Cover", "Sprinter"],
}

# Source weighting — EAFC physical attrs heavily dampened
# EAFC inflates pace/acceleration/balance/movement to unrealistic levels
# (37-year-old Messi scores 127 on Sprinter from EAFC data)
SOURCE_WEIGHT = {
    "scout_assessment": 1.0,
    "fbref": 1.0,
    "eafc_inferred": 0.75,
}

# Extra dampening for EAFC on physical model attributes
# These attrs drive Sprinter/Target/Powerhouse inflation
EAFC_PHYSICAL_DAMPENING = 0.40  # applied ON TOP of 0.75 base weight
EAFC_PHYSICAL_ATTRS = {
    "acceleration", "balance", "movement", "pace",          # Sprinter
    "aerial_duels", "heading", "jumping", "volleys",        # Target
    "aggression", "duels", "shielding", "throwing",          # Powerhouse
}


def score_models(attr_scores: dict, position: str | None) -> dict[str, float]:
    """Score all 13 models from normalized attribute scores."""
    scores = {}
    pos = position or ""
    affinity_set = set(POS_AFFINITY.get(pos, []))

    for model, core_attrs in MODEL_ATTRIBUTES.items():
        vals = [attr_scores.get(a) for a in core_attrs if a in attr_scores]
        if len(vals) < 2:
            scores[model] = 0.0
            continue

        raw = sum(vals) / len(vals)

        if model == "GK" and pos != "GK":
            raw *= 0.3
        elif model != "GK" and pos == "GK":
            raw *= 0.3

        if model in affinity_set:
            raw += 0.3

        scores[model] = round(raw, 1)

    return scores


def find_secondary(scores: dict[str, float], existing_primary: str,
                   threshold: float = 15.0, secondary_ratio: float = 0.50) -> str | None:
    """
    Find a secondary model for an existing single-model player.

    KEEPS the existing primary — only finds the best secondary from a
    different category. This avoids EAFC inflation re-ranking the primary
    (e.g. Kane becoming Sprinter-Passer instead of Striker-X).
    """
    primary_score = scores.get(existing_primary, 0)
    if primary_score < threshold:
        # Primary doesn't even score well — can't assign secondary
        return None

    primary_cat = MODEL_COMPOUNDS.get(existing_primary)

    # Rank all OTHER models by score
    candidates = sorted(
        [(m, s) for m, s in scores.items() if m != existing_primary],
        key=lambda x: -x[1]
    )

    # First pass: prefer cross-category secondary (different dimension = more interesting)
    for secondary_name, secondary_score in candidates:
        secondary_cat = MODEL_COMPOUNDS.get(secondary_name)
        if (secondary_score >= threshold
                and secondary_score >= primary_score * secondary_ratio
                and primary_cat != secondary_cat):
            return f"{existing_primary}-{secondary_name}"
        if secondary_score < threshold:
            break

    # Second pass: allow same-category if it's strong enough (80%+ of primary)
    # This enables natural combos like Striker-Passer, Cover-Destroyer
    for secondary_name, secondary_score in candidates:
        if (secondary_score >= threshold
                and secondary_score >= primary_score * 0.80):
            return f"{existing_primary}-{secondary_name}"
        if secondary_score < threshold:
            break

    return None


def normalize_grades(grades: list[tuple]) -> dict[str, float]:
    """
    Normalize attribute grades to 0-100 scale.
    grades: list of (attribute, source, scout_grade, stat_score)
    """
    # Group by attribute, pick best source
    by_attr: dict[str, list[tuple]] = {}
    for attr, source, scout_grade, stat_score in grades:
        # Apply aliases
        canonical = ATTR_ALIASES.get(attr, attr)
        by_attr.setdefault(canonical, []).append((source, scout_grade, stat_score))

    attr_scores = {}
    for attr, candidates in by_attr.items():
        # Pick best source by priority
        best_src = None
        best_val = None
        best_priority = -1

        for source, sg, ss in candidates:
            priority = SOURCE_PRIORITY.get(source, 0)
            val = sg if sg is not None else ss
            if val is not None and priority > best_priority:
                best_priority = priority
                best_src = source
                best_val = val

        if best_val is None:
            continue

        # Detect scale: scout grades 0-10, stats 0-100
        if best_src == "scout_assessment":
            scale = 10.0
        elif best_val > 20:
            scale = 100.0
        else:
            scale = 10.0

        weight = SOURCE_WEIGHT.get(best_src, 0.8)
        # Extra dampening for EAFC physical attributes
        if best_src == "eafc_inferred" and attr in EAFC_PHYSICAL_ATTRS:
            weight *= EAFC_PHYSICAL_DAMPENING
        attr_scores[attr] = (best_val / scale) * 100.0 * weight

    return attr_scores


def main():
    conn = require_conn()
    cur = conn.cursor()

    # Load single-model players
    if args.player:
        where = f"p.id = {args.player}"
    else:
        active_clause = "" if args.all else "p.active = true AND"
        where = f"{active_clause} pp.level >= {args.min_level} AND pp.archetype IS NOT NULL AND pp.archetype NOT LIKE '%%-%%'"

    cur.execute(f"""
        SELECT p.id, p.name, pp.archetype, pp.level, pp.position
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        WHERE {where}
        ORDER BY pp.level DESC NULLS LAST, p.name
    """)
    players = cur.fetchall()
    print(f"Loaded {len(players)} single-model players (min level {args.min_level}, ratio {args.threshold})")

    fixed = 0
    still_single = 0
    no_grades = 0
    updates = []

    for pid, name, current_arch, level, position in players:
        # Fetch attribute grades
        cur.execute("""
            SELECT attribute, source, scout_grade, stat_score
            FROM attribute_grades
            WHERE player_id = %s
        """, (pid,))
        grades = cur.fetchall()

        if not grades:
            no_grades += 1
            continue

        # Normalize and score
        attr_scores = normalize_grades(grades)
        if not attr_scores:
            no_grades += 1
            continue

        model_scores = score_models(attr_scores, position)
        new_compound = find_secondary(model_scores, current_arch,
                                      threshold=15.0, secondary_ratio=args.threshold)

        if not new_compound:
            still_single += 1
            if args.player:
                print(f"\n  {name} ({position}, level {level})")
                print(f"  Current: {current_arch} (keeping — no qualifying secondary)")
                print(f"  Model scores (primary={current_arch}, score={model_scores.get(current_arch, 0):.1f}):")
                for m, s in sorted(model_scores.items(), key=lambda x: -x[1])[:6]:
                    cat = MODEL_COMPOUNDS.get(m, "?")
                    marker = "←" if m == current_arch else " "
                    print(f"    {marker} {m:15s} ({cat:9s}) = {s:5.1f}")
            continue

        fixed += 1

        if DRY_RUN or args.player:
            print(f"  {level:>2d}  {position or '?':>3s}  {current_arch:15s}  →  {new_compound:25s}  {name}")
            if args.player:
                print(f"  Model scores:")
                for m, s in sorted(model_scores.items(), key=lambda x: -x[1])[:6]:
                    cat = MODEL_COMPOUNDS.get(m, "?")
                    print(f"    {m:15s} ({cat:9s}) = {s:5.1f}")
        else:
            updates.append((new_compound, pid))

    # Write
    if not DRY_RUN and not args.player and updates:
        batch_size = 500
        for i in range(0, len(updates), batch_size):
            batch = updates[i:i + batch_size]
            cur.executemany("""
                UPDATE player_profiles SET archetype = %s WHERE person_id = %s
            """, batch)
        conn.commit()
        print(f"\nWritten {len(updates)} compound updates")

    print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}Results:")
    print(f"  Fixed (got secondary): {fixed}")
    print(f"  Still single:          {still_single}")
    print(f"  No grades:             {no_grades}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
